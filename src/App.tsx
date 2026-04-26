import React, { useState, useEffect, useCallback } from 'react';
import { Search, Link as LinkIcon, ExternalLink, Loader2, Sparkles, AlertCircle, LayoutGrid, List as ListIcon, LogOut, User as UserIcon, CheckCircle2, XCircle, ArrowRight, Rocket, FileJson, FileSpreadsheet, History, ShieldAlert } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, getDocs, limit, where } from 'firebase/firestore';

import { HistoryView } from './components/HistoryView';
import { AdminView } from './components/AdminView';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ExtractedLink {
  text: string;
  href: string;
  isExternal: boolean;
}

interface PageData {
  title: string;
  description: string;
  links: ExtractedLink[];
  pagesCrawled?: number;
}

interface AIAnalysis {
  score_global: number;
  main_message: string;
  scores: {
    structure: number;
    conversion: number;
    presence: number;
  };
  problems: {
    title: string;
    impact: string;
  }[];
  opportunities: string[];
  business_type: string;
  categories: Record<string, ExtractedLink[]>;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<PageData | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [deepScan, setDeepScan] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'history' | 'admin'>('dashboard');

  // Auth & Usage State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userExtractions, setUserExtractions] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // Settings State
  const [maxAnonExtractions, setMaxAnonExtractions] = useState(2);
  const [maxUserExtractions, setMaxUserExtractions] = useState(50);
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [emailVerifyApiKey, setEmailVerifyApiKey] = useState<string | null>(null);

  // History & Admin State
  const [history, setHistory] = useState<any[]>([]);
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);

  // Inactivity Timeout (5 minutes)
  const resetInactivityTimer = useCallback(() => {
    if (!user || user.isAnonymous) return;
    
    // Clear existing timer
    if ((window as any).inactivityTimer) {
      clearTimeout((window as any).inactivityTimer);
    }
    
    // Set new timer
    (window as any).inactivityTimer = setTimeout(() => {
      signOut(auth).then(() => {
        setError("Vous avez été déconnecté pour inactivité (5 minutes).");
      });
    }, 300000); // 5 minutes
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setIsAuthReady(false);
        try {
          await signInAnonymously(auth);
        } catch (error: any) {
          console.error("Erreur d'authentification anonyme:", error);
          if (error.code === 'auth/operation-not-allowed') {
            setError("Veuillez activer l'authentification anonyme dans la console Firebase.");
          }
        }
        return;
      }

      setUser(currentUser);
      setIsAuthReady(true);
      
      // Fetch or create user document
      const userRef = doc(db, 'users', currentUser.uid);
      let userSnap;
      
      try {
        userSnap = await getDoc(userRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        return;
      }

      // Check email verification if not anonymous and API key is present
      let emailStatus = userSnap.exists() ? userSnap.data().emailStatus : undefined;
      
      if (!currentUser.isAnonymous && currentUser.email && emailVerifyApiKey && emailStatus !== 'ok') {
        try {
          const res = await fetch(`https://apps.emaillistverify.com/api/verifyEmail?secret=${emailVerifyApiKey}&email=${currentUser.email}`);
          const status = await res.text();
          
          if (['disposable', 'invalid', 'spam_trap'].includes(status)) {
            emailStatus = 'invalid';
            await signOut(auth);
            setError("Votre adresse email n'est pas autorisée (email temporaire ou invalide).");
            return;
          } else {
            emailStatus = 'ok';
          }
        } catch (e) {
          console.error("Email verification failed", e);
        }
      }
      
      if (!userSnap.exists()) {
        try {
          await setDoc(userRef, {
            email: currentUser.email || 'Anonyme',
            extractionCount: 0,
            lastActive: new Date().toISOString(),
            role: 'user',
            ...(emailStatus ? { emailStatus } : {})
          });
          setUserExtractions(0);
          setIsAdmin(currentUser.email === 'gnzikoune@gmail.com');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
        }
      } else {
        // Update emailStatus if it was just verified
        if (emailStatus === 'ok' && userSnap.data().emailStatus !== 'ok') {
          try {
            await setDoc(userRef, { emailStatus: 'ok' }, { merge: true });
          } catch (e) {
            console.error("Failed to update emailStatus", e);
          }
        }
        setUserExtractions(userSnap.data().extractionCount || 0);
        setIsAdmin(currentUser.email === 'gnzikoune@gmail.com');
      }
    });

    return () => unsubscribe();
  }, [emailVerifyApiKey]);

  useEffect(() => {
    // Fetch global settings
    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.maxAnonExtractions !== undefined) setMaxAnonExtractions(data.maxAnonExtractions);
        if (data.maxUserExtractions !== undefined) setMaxUserExtractions(data.maxUserExtractions);
        if (data.geminiApiKey) setGeminiApiKey(data.geminiApiKey);
        if (data.emailVerifyApiKey) setEmailVerifyApiKey(data.emailVerifyApiKey);
      }
    }, (error) => {
      console.error("Failed to fetch settings:", error);
    });

    return () => unsubscribeSettings();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserExtractions(docSnap.data().extractionCount || 0);
      }
    }, (error: any) => {
      if (error.code === 'permission-denied' && !auth.currentUser) {
        // Ignore permission denied error during sign out
        return;
      }
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  useEffect(() => {
    if (user && !user.isAnonymous) {
      // Setup inactivity listeners
      const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
      events.forEach(event => window.addEventListener(event, resetInactivityTimer));
      resetInactivityTimer(); // Initial call
      
      return () => {
        events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
        if ((window as any).inactivityTimer) {
          clearTimeout((window as any).inactivityTimer);
        }
      };
    }
  }, [user, resetInactivityTimer]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setError(null);
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Erreur lors de la connexion.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPageData(null);
      setAiAnalysis(null);
      setUrl('');
    } catch (err: any) {
      console.error("Logout error:", err);
    }
  };

  useEffect(() => {
    if (currentView === 'history' && user && !user.isAnonymous) {
      setIsLoadingHistory(true);
      const fetchHistory = async () => {
        try {
          const q = query(collection(db, 'analyses'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50));
          const querySnapshot = await getDocs(q);
          const userHistory = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setHistory(userHistory);
        } catch (error) {
          console.error("Failed to fetch history:", error);
        } finally {
          setIsLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [currentView, user]);

  useEffect(() => {
    if (currentView === 'admin' && isAdmin) {
      setIsLoadingAdmin(true);
      const fetchAdminData = async () => {
        try {
          const analysesQuery = query(collection(db, 'analyses'), orderBy('createdAt', 'desc'), limit(100));
          const analysesSnap = await getDocs(analysesQuery);
          setAllHistory(analysesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          const usersQuery = query(collection(db, 'users'), limit(100));
          const usersSnap = await getDocs(usersQuery);
          setAllUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error("Failed to fetch admin data:", error);
        } finally {
          setIsLoadingAdmin(false);
        }
      };
      fetchAdminData();
    }
  }, [currentView, isAdmin]);

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    // Check limits
    if (user?.isAnonymous && userExtractions >= maxAnonExtractions) {
      setShowQuotaModal(true);
      return;
    }
    if (!user?.isAnonymous && userExtractions >= maxUserExtractions) {
      setError(`Vous avez atteint la limite maximale de ${maxUserExtractions} liens pour votre compte.`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setPageData(null);
    setAiAnalysis(null);
    setAiError(null);
    setCurrentAnalysisId(null);

    try {
      // Check for existing analysis
      const normalizedUrl = new URL(url).href;
      const q = query(collection(db, 'analyses'), where('url', '==', normalizedUrl.substring(0, 1999)), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        const existingData = existingDoc.data();
        
        setPageData({
          title: existingData.raw.title,
          description: existingData.raw.description,
          links: existingData.raw.links,
          pagesCrawled: existingData.raw.pagesCrawled
        });
        
        if (existingData.ai) {
          setAiAnalysis({
            score_global: existingData.ai.scoreGlobal,
            main_message: existingData.ai.mainMessage,
            scores: existingData.ai.scores,
            problems: existingData.ai.problems,
            opportunities: existingData.ai.opportunities,
            business_type: existingData.ai.businessType,
            categories: existingData.ai.categories
          });
        }
        
        setCurrentAnalysisId(existingDoc.id);
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, deepScan: (!user?.isAnonymous) ? deepScan : false }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Échec de l\'extraction des liens');
      }

      const data = await response.json();
      setPageData(data);

      // Calculate metrics
      const links = data.links || [];
      const internalLinks = links.filter((l: ExtractedLink) => !l.isExternal);
      const externalLinks = links.filter((l: ExtractedLink) => l.isExternal);
      
      // Get unique internal URLs
      const uniqueInternalUrls = new Set(internalLinks.map((l: ExtractedLink) => l.href.split('#')[0]));
      
      const hasContactPage = Array.from(uniqueInternalUrls).some(href => typeof href === 'string' && href.toLowerCase().includes('contact'));
      const hasAboutPage = Array.from(uniqueInternalUrls).some(href => typeof href === 'string' && (href.toLowerCase().includes('about') || href.toLowerCase().includes('propos')));
      const hasServicesPage = Array.from(uniqueInternalUrls).some(href => typeof href === 'string' && (href.toLowerCase().includes('service') || href.toLowerCase().includes('produit')));
      const hasActionPage = Array.from(uniqueInternalUrls).some(href => {
        if (typeof href !== 'string') return false;
        const h = href.toLowerCase();
        return h.includes('signup') || h.includes('login') || h.includes('buy') || h.includes('reservation') || h.includes('cart') || h.includes('panier');
      });

      const metrics = {
        totalLinks: links.length,
        uniqueInternalLinksCount: uniqueInternalUrls.size,
        internalLinksCount: internalLinks.length,
        externalLinksCount: externalLinks.length,
        internalExternalRatio: links.length > 0 ? internalLinks.length / links.length : 0,
        hasContactPage,
        hasAboutPage,
        hasServicesPage,
        hasActionPage
      };

      // Save to global analyses collection
      if (user) {
        try {
          const analysisRef = await addDoc(collection(db, 'analyses'), {
            url: normalizedUrl.substring(0, 1999),
            userId: user.uid,
            isAnonymous: user.isAnonymous,
            createdAt: new Date().toISOString(),
            scanType: deepScan && !user.isAnonymous ? 'deep' : 'single_page',
            raw: {
              title: (data.title || '').substring(0, 999),
              description: (data.description || '').substring(0, 4999),
              totalLinks: links.length,
              // Store up to 1000 links to avoid 1MB limit
              links: links.slice(0, 1000).map((l: ExtractedLink) => ({
                text: (l.text || '').substring(0, 200),
                href: (l.href || '').substring(0, 500),
                isExternal: l.isExternal
              }))
            },
            metrics
          });
          setCurrentAnalysisId(analysisRef.id);
        } catch (error) {
          console.error("Failed to save analysis:", error);
          // Don't throw, we still want to show the results
        }
      }

      // Update usage count
      if (user) {
        try {
          const newCount = userExtractions + 1;
          await setDoc(doc(db, 'users', user.uid), { 
            extractionCount: newCount,
            email: user.email || 'Anonyme',
            lastActive: new Date().toISOString()
          }, { merge: true });

          // Save extraction history
          await addDoc(collection(db, 'users', user.uid, 'extractions'), {
            url: normalizedUrl.substring(0, 1999),
            title: (data.title || '').substring(0, 999),
            description: (data.description || '').substring(0, 4999),
            linksCount: data.links?.length || 0,
            createdAt: new Date().toISOString(),
            userId: user.uid
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur inattendue est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!pageData || pageData.links.length === 0) return;

    setIsAnalyzing(true);
    setAiError(null);

    try {
      const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('La clé API Gemini n\'est pas configurée');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Analyze the following webpage and its extracted links to provide a business conversion diagnostic.
        URL: ${url}
        Title: ${pageData.title}
        Description: ${pageData.description}
        
        Total Links: ${pageData.links.length}
        Links Data:
        ${JSON.stringify(pageData.links.slice(0, 800).map((l, index) => ({ id: index, text: l.text, href: l.href })))}
        
        Please provide a comprehensive business diagnostic of this webpage based on its metadata and links:
        
        1. "score_global": A score out of 100 representing the overall conversion potential.
        2. "main_message": A single, impactful sentence summarizing the main issue or opportunity (e.g., "⚠️ Votre site présente plusieurs points qui peuvent vous faire perdre des clients"). (IN FRENCH)
        3. "scores": Provide sub-scores out of 100 for "structure", "conversion", and "presence" (digital presence).
        4. "problems": Identify 3 to 5 main business weaknesses based on the links (e.g., missing booking page, confusing navigation). For each, provide a "title" (the problem) and "impact" (the business consequence, e.g., "Vous perdez des clients prêts à passer à l'action"). (IN FRENCH)
        5. "opportunities": Provide 2 to 4 concrete, actionable improvements. (IN FRENCH)
        6. "business_type": Guess the type of business (e.g., "restaurant", "e-commerce", "blog", "agence", "inconnu"). (IN FRENCH)
        7. "categories": Categorize ALL the provided links into meaningful groups (e.g., "Navigation du site", "Réseaux Sociaux", "Articles", "Ressources Externes", etc.). 
           IMPORTANT: To save space, return the "id" of each link in the corresponding category array. EVERY single link id from 0 to ${Math.min(pageData.links.length, 800) - 1} MUST be placed in exactly one category. (IN FRENCH)
        
        Return the response strictly as a JSON object with this structure:
        {
          "score_global": 62,
          "main_message": "⚠️ Votre site présente plusieurs points qui peuvent vous faire perdre des clients",
          "scores": {
            "structure": 70,
            "conversion": 40,
            "presence": 75
          },
          "problems": [
            {
              "title": "Aucun système de réservation",
              "impact": "Vous perdez des clients prêts à passer à l'action"
            }
          ],
          "opportunities": [
            "Ajouter un système de réservation",
            "Simplifier le menu principal"
          ],
          "business_type": "restaurant",
          "categories": {
            "Navigation": [0, 1, 5],
            "Réseaux Sociaux": [2, 3]
          }
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          tools: [{ googleSearch: {} }],
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        
        // Map back to ExtractedLink format using the returned indices
        const categories: Record<string, ExtractedLink[]> = {};
        for (const [category, linkIds] of Object.entries(parsed.categories)) {
          categories[category] = (linkIds as number[])
            .map(id => pageData.links[id])
            .filter(Boolean); // Filter out any undefined in case AI hallucinates an ID
        }
        
        const aiResult = {
          score_global: parsed.score_global || 50,
          main_message: parsed.main_message || "Analyse terminée",
          scores: parsed.scores || { structure: 50, conversion: 50, presence: 50 },
          problems: parsed.problems || [],
          opportunities: parsed.opportunities || [],
          business_type: parsed.business_type || "inconnu",
          categories
        };
        
        setAiAnalysis(aiResult);

        // Update the global analysis document
        if (currentAnalysisId && user) {
          try {
            // We only save the categories keys and counts to avoid duplicating the links array
            const categoriesSummary: Record<string, number> = {};
            for (const [cat, catLinks] of Object.entries(categories)) {
              categoriesSummary[cat] = catLinks.length;
            }

            await setDoc(doc(db, 'analyses', currentAnalysisId), {
              ai: {
                scoreGlobal: aiResult.score_global,
                mainMessage: aiResult.main_message,
                scores: aiResult.scores,
                problems: aiResult.problems,
                opportunities: aiResult.opportunities,
                businessType: aiResult.business_type,
                categories: categoriesSummary
              }
            }, { merge: true });
          } catch (error) {
            console.error("Failed to update analysis with AI results:", error);
          }
        }
      } else {
        throw new Error('Aucune réponse de Gemini');
      }
    } catch (err: any) {
      console.error('AI Analysis error:', err);
      setAiError(err.message || 'Échec de l\'analyse avec Gemini');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportJSON = () => {
    if (!pageData) return;
    const exportData = {
      url,
      scrapedAt: new Date().toISOString(),
      page: pageData,
      analysis: aiAnalysis
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    a.download = `extract-${new URL(url).hostname}.json`;
    a.click();
    URL.revokeObjectURL(urlObj);
  };

  const handleExportCSV = () => {
    if (!pageData) return;
    const linkToCategory = new Map<string, string>();
    if (aiAnalysis) {
      (Object.entries(aiAnalysis.categories) as [string, ExtractedLink[]][]).forEach(([cat, links]) => {
        links.forEach(l => linkToCategory.set(l.href, cat));
      });
    }

    const headers = ['Texte', 'URL', 'Externe', 'Catégorie (IA)'];
    const rows = pageData.links.map(l => [
      `"${(l.text || '').replace(/"/g, '""')}"`,
      `"${l.href}"`,
      l.isExternal ? 'Oui' : 'Non',
      `"${linkToCategory.get(l.href) || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    a.download = `extract-${new URL(url).hostname}.csv`;
    a.click();
    URL.revokeObjectURL(urlObj);
  };

  const isDashboardView = isAuthReady && user && !user.isAnonymous;

  return (
    <div className={cn("min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900", isDashboardView ? "flex" : "")}>
      
      {/* Sidebar (Desktop) */}
      {isDashboardView && (
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed inset-y-0 z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white mr-3">
            <LinkIcon className="w-5 h-5" />
          </div>
          <h1 className="font-semibold text-lg tracking-tight">Extracteur</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={cn("w-full px-3 py-2.5 rounded-lg font-medium flex items-center gap-3 transition-colors", currentView === 'dashboard' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}
          >
            <LayoutGrid className="w-5 h-5" />
            Tableau de bord
          </button>
          
          {user && !user.isAnonymous && (
            <button 
              onClick={() => setCurrentView('history')}
              className={cn("w-full px-3 py-2.5 rounded-lg font-medium flex items-center gap-3 transition-colors", currentView === 'history' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}
            >
              <History className="w-5 h-5" />
              Historique
            </button>
          )}

          {isAdmin && (
            <button 
              onClick={() => setCurrentView('admin')}
              className={cn("w-full px-3 py-2.5 rounded-lg font-medium flex items-center gap-3 transition-colors", currentView === 'admin' ? "bg-purple-50 text-purple-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}
            >
              <ShieldAlert className="w-5 h-5" />
              Administration
            </button>
          )}
        </nav>

        {/* User Profile in Sidebar */}
        <div className="p-4 border-t border-slate-200">
          {isAuthReady ? (
            user && !user.isAnonymous ? (
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    {user.email?.[0].toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.displayName || 'Utilisateur'}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Se déconnecter"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-3">Mode gratuit ({userExtractions}/{maxAnonExtractions})</p>
                <button 
                  onClick={handleLogin}
                  className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Se connecter
                </button>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center gap-2 text-slate-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>
      </aside>
      )}

      {/* Main Content */}
      <div className={cn("flex-1 flex flex-col min-w-0", isDashboardView ? "md:ml-64" : "")}>
        {/* Header */}
        {isDashboardView ? (
          <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-10">
            <div className="px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <h1 className="font-semibold text-lg tracking-tight">Extracteur</h1>
              </div>
              {isAuthReady && user && !user.isAnonymous && (
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {user.email?.[0].toUpperCase() || 'U'}
                    </div>
                  )}
                  <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </header>
        ) : (
          <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 shadow-sm transition-all">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <h1 className="font-bold text-lg tracking-tight text-slate-900">Extracteur<span className="text-indigo-600">IA</span></h1>
              </div>
              <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-slate-600">
                <span className="hidden sm:inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-slate-600 text-xs font-semibold border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Gratuit : {userExtractions}/{maxAnonExtractions}
                </span>
                <button onClick={handleLogin} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
                  Se connecter
                </button>
              </div>
            </div>
          </header>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Top Dashboard Stats */}
            {currentView === 'dashboard' && isDashboardView && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Stat Card 1: Quota */}
              <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 p-5 sm:p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="font-semibold text-slate-600 text-sm">Extractions utilisées</h3>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-3 relative z-10">
                  <span className="text-3xl font-black text-slate-900">{userExtractions}</span>
                  <span className="text-slate-500 text-sm font-medium">/ {user && !user.isAnonymous ? maxUserExtractions : maxAnonExtractions}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative z-10">
                  <div 
                    className={cn("h-full rounded-full transition-all", userExtractions >= (user && !user.isAnonymous ? maxUserExtractions : maxAnonExtractions) ? "bg-red-500" : "bg-gradient-to-r from-indigo-500 to-purple-500")}
                    style={{ width: `${Math.min((userExtractions / (user && !user.isAnonymous ? maxUserExtractions : maxAnonExtractions)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stat Card 2: Account Status */}
              <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 p-5 sm:p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="font-semibold text-slate-600 text-sm">Statut du compte</h3>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <UserIcon className="w-5 h-5" />
                  </div>
                </div>
                {isAuthReady ? (
                  user && !user.isAnonymous ? (
                    <div className="relative z-10">
                      <p className="text-xl font-bold text-slate-900 mb-0.5">Connecté</p>
                      <p className="text-xs font-medium text-slate-500 truncate">{user.email}</p>
                    </div>
                  ) : (
                    <div className="relative z-10">
                      <p className="text-xl font-bold text-slate-900 mb-0.5">Anonyme</p>
                      <button onClick={handleLogin} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold mt-0.5 transition-colors">
                        Créer un compte
                      </button>
                    </div>
                  )
                ) : (
                  <div className="animate-pulse flex space-x-4 relative z-10">
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stat Card 3: AI Model */}
              <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 p-5 sm:p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="font-semibold text-slate-600 text-sm">Moteur d'analyse</h3>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Rocket className="w-5 h-5" />
                  </div>
                </div>
                <div className="relative z-10">
                  <p className="text-xl font-bold text-slate-900 mb-0.5">Gemini 3.0</p>
                  <p className="text-xs font-medium text-slate-500">Flash Preview</p>
                </div>
              </div>
              </div>
            )}
            {/* Search Form / Hero Section */}
            {currentView === 'dashboard' && !isDashboardView ? (
              <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800 p-6 sm:p-10 lg:p-12 mb-12">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-purple-500/10 blur-[80px] rounded-full pointer-events-none"></div>
                
                <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">

                  <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.2]"
                  >
                    Extrayez les liens de <br className="hidden sm:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">n'importe quelle URL</span>
                  </motion.h1>
 
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto"
                  >
                    Vous cherchez un moyen rapide de récupérer tous les liens d'une page web ? Notre outil gratuit vous permet d'extraire chaque lien en quelques secondes et d'obtenir un diagnostic IA complet.
                  </motion.p>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 p-1.5 sm:p-2 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl"
                  >
                    <form onSubmit={handleExtract} className="relative flex flex-col gap-4">
                      <div className="relative flex items-center">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://exemple.com"
                          required
                          aria-label="URL du site à analyser"
                          className="block w-full pl-12 pr-32 py-4 bg-white border border-transparent rounded-xl text-slate-900 text-base placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 transition-shadow"
                        />
                        <button
                          type="submit"
                          aria-label="Lancer l'extraction des liens"
                          disabled={isLoading || (user?.isAnonymous && userExtractions >= maxAnonExtractions) || (!user?.isAnonymous && userExtractions >= maxUserExtractions)}
                          className="absolute right-1.5 top-1.5 bottom-1.5 px-5 sm:px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-900/20"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="hidden sm:inline">Analyse...</span>
                            </>
                          ) : (
                            <span className="hidden sm:inline">Diagnostiquer</span>
                          )}
                          {!isLoading && <Rocket className="w-4 h-4 sm:hidden" />}
                        </button>
                      </div>
                      
                      {isLoading && (
                        <div className="text-sm text-indigo-300 animate-pulse flex flex-col items-center gap-1 mt-2">
                          <span className="font-medium">Analyse de votre structure en cours...</span>
                          <span className="text-slate-400">Détection des points faibles et évaluation de votre potentiel de conversion...</span>
                        </div>
                      )}
                    </form>
                  </motion.div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-center gap-2 text-red-400 bg-red-900/30 border border-red-900/50 p-4 rounded-xl text-sm"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p>{error}</p>
                    </motion.div>
                  )}
                </div>
              </section>
            ) : (
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 sm:p-8 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="relative z-10 max-w-3xl mx-auto">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Nouvelle analyse</h2>
                  <p className="text-slate-500 mb-6">Entrez l'URL du site que vous souhaitez explorer et diagnostiquer.</p>
                  <form onSubmit={handleExtract} className="relative flex flex-col gap-4">
                    <div className="relative flex items-center">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search className="h-6 w-6 text-slate-400" />
                      </div>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://exemple.com"
                        required
                        className="block w-full pl-14 pr-36 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                      />
                      <button
                        type="submit"
                        disabled={isLoading || userExtractions >= maxUserExtractions}
                        className="absolute right-2 top-2 bottom-2 px-6 sm:px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="hidden sm:inline">Analyse...</span>
                          </>
                        ) : (
                          <span className="hidden sm:inline">Diagnostiquer</span>
                        )}
                        {!isLoading && <Rocket className="w-5 h-5 sm:hidden" />}
                      </button>
                    </div>
                    
                    {isLoading && (
                      <div className="text-sm text-indigo-600 animate-pulse flex items-center gap-2 mt-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analyse de la structure en cours...</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 text-sm text-slate-600 mt-2">
                      <input 
                        type="checkbox" 
                        id="deepScanDash" 
                        checked={deepScan} 
                        onChange={(e) => setDeepScan(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <label htmlFor="deepScanDash" className="cursor-pointer select-none hover:text-slate-900 transition-colors">
                        Exploration approfondie (Scanner jusqu'à 15 pages du site)
                      </label>
                    </div>
                  </form>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 p-4 rounded-xl text-sm"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p>{error}</p>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Landing Page Content (Visible when no search active AND not logged in) */}
            {currentView === 'dashboard' && !pageData && !isLoading && !isDashboardView && (
              <>
                {/* Features Section */}
                <section className="py-8">
                  <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Une analyse complète en <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">quelques secondes</span></h2>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">Tout ce dont vous avez besoin pour comprendre et optimiser la structure de votre site, réuni dans un seul outil puissant.</p>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {/* Large Card */}
                    <div className="md:col-span-2 bg-slate-50 rounded-2xl p-8 border border-slate-200 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-200/50 rounded-full blur-3xl -mr-20 -mt-20 transition-transform group-hover:scale-110"></div>
                      <div className="relative z-10">
                        <div className="w-12 h-12 bg-white text-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                          <Search className="w-6 h-6" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-3">Scan Profond & Exhaustif</h3>
                        <p className="text-base text-slate-600 leading-relaxed max-w-md">Explorez votre site pour cartographier l'intégralité de vos liens internes et externes. Détectez les pages orphelines, les redirections et les erreurs de maillage en un clin d'œil.</p>
                      </div>
                    </div>
 
                    {/* Small Card 1 */}
                    <div className="bg-slate-900 rounded-2xl p-8 relative overflow-hidden group hover:shadow-2xl transition-all duration-500 text-white">
                      <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-500/30 rounded-full blur-2xl transition-transform group-hover:scale-150"></div>
                      <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/10 text-purple-300 rounded-xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/10">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Diagnostic IA</h3>
                        <p className="text-slate-300 text-sm leading-relaxed">Notre moteur Gemini 3.0 identifie instantanément les failles de conversion et les opportunités business.</p>
                      </div>
                    </div>
 
                    {/* Small Card 2 */}
                    <div className="md:col-span-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-100 relative overflow-hidden group hover:shadow-xl transition-all duration-500 flex flex-col md:flex-row items-center gap-8">
                      <div className="flex-1 relative z-10">
                        <div className="w-12 h-12 bg-white text-emerald-600 rounded-xl flex items-center justify-center mb-5 shadow-sm border border-emerald-100">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Export Structuré & Actionnable</h3>
                        <p className="text-base text-slate-600 leading-relaxed">Téléchargez vos données enrichies en CSV ou JSON. Idéal pour les intégrer à vos propres outils d'analyse, créer des rapports personnalisés ou les partager avec votre équipe technique.</p>
                      </div>
                      <div className="flex-1 w-full bg-white/60 backdrop-blur-sm rounded-2xl border border-white p-6 shadow-sm">
                         <div className="space-y-4">
                           <div className="flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">CSV</div><div className="h-3 bg-emerald-200/50 rounded w-3/4"></div></div>
                           <div className="flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">JSON</div><div className="h-3 bg-indigo-200/50 rounded w-1/2"></div></div>
                           <div className="flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">API</div><div className="h-3 bg-purple-200/50 rounded w-5/6"></div></div>
                         </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* How it works */}
                <section className="py-16 bg-slate-50 rounded-3xl border border-slate-200/60 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl -ml-20 -mb-20"></div>
                  
                  <div className="text-center mb-16 relative z-10">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Comment ça marche ?</h2>
                    <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">Un processus simple et transparent en trois étapes pour auditer votre site web.</p>
                  </div>
                  
                  <div className="max-w-5xl mx-auto relative z-10 px-4">
                    {/* Connecting Line (Desktop only) */}
                    <div className="hidden md:block absolute top-10 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-indigo-200 via-purple-300 to-emerald-200 rounded-full"></div>
                    
                    <div className="grid md:grid-cols-3 gap-10 md:gap-8">
                      {/* Step 1 */}
                      <div className="relative text-center group">
                        <div className="w-16 h-16 mx-auto bg-white rounded-xl shadow-xl shadow-indigo-900/5 border border-slate-100 flex items-center justify-center relative z-10 mb-6 group-hover:-translate-y-1 transition-transform duration-300">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-white rounded-xl"></div>
                          <span className="relative text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-indigo-400">1</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Entrez votre URL</h3>
                        <p className="text-base text-slate-600 leading-relaxed">Saisissez l'adresse de votre site. Notre robot parcourt vos pages pour en extraire la structure avec précision.</p>
                      </div>
                      
                      {/* Step 2 */}
                      <div className="relative text-center group">
                        <div className="w-16 h-16 mx-auto bg-white rounded-xl shadow-xl shadow-purple-900/5 border border-slate-100 flex items-center justify-center relative z-10 mb-6 group-hover:-translate-y-1 transition-transform duration-300">
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-white rounded-xl"></div>
                          <span className="relative text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-600 to-purple-400">2</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">L'IA analyse</h3>
                        <p className="text-base text-slate-600 leading-relaxed">Gemini évalue votre maillage, détecte votre type de business et repère les points de friction bloquants.</p>
                      </div>
                      
                      {/* Step 3 */}
                      <div className="relative text-center group">
                        <div className="w-16 h-16 mx-auto bg-white rounded-xl shadow-xl shadow-emerald-900/5 border border-slate-100 flex items-center justify-center relative z-10 mb-6 group-hover:-translate-y-1 transition-transform duration-300">
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-white rounded-xl"></div>
                          <span className="relative text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-600 to-emerald-400">3</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Passez à l'action</h3>
                        <p className="text-base text-slate-600 leading-relaxed">Obtenez un score clair, des recommandations concrètes et exportez vos données pour agir immédiatement.</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* CTA */}
                {(!user || user.isAnonymous) && (
                  <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 p-8 sm:p-12 text-center shadow-2xl">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}></div>
                    <div className="relative z-10">
                      <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 tracking-tight">Prêt à débloquer votre potentiel ?</h2>
                      <p className="text-lg text-indigo-100 mb-8 max-w-2xl mx-auto">Rejoignez les utilisateurs qui optimisent déjà leur conversion grâce à l'analyse structurelle par IA.</p>
                      <button onClick={handleLogin} className="px-8 py-4 bg-white text-indigo-600 hover:bg-indigo-50 font-extrabold rounded-xl shadow-xl shadow-indigo-900/20 transition-all hover:scale-105 hover:-translate-y-1 flex items-center gap-3 mx-auto text-base">
                        <UserIcon className="w-5 h-5" />
                        Créer un compte gratuit
                      </button>
                      <p className="mt-4 text-xs text-indigo-200 font-medium">Jusqu'à {maxUserExtractions} analyses gratuites avec un compte.</p>
                    </div>
                  </section>
                )}
                
              </>
            )}

          </div>
          {/* end max-w-6xl */}





        {/* Results Area */}
        {currentView === 'dashboard' && (
          <AnimatePresence mode="wait">
          {pageData && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Page Info & AI Action */}
              <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-40 h-40 bg-indigo-50 rounded-full blur-3xl -ml-10 -mt-10"></div>
                <div className="space-y-1.5 relative z-10">
                  <h3 className="font-bold text-xl text-slate-900 line-clamp-1" title={pageData.title}>
                    {pageData.title}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2 max-w-2xl" title={pageData.description}>
                    {pageData.description || 'Aucune description disponible.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs font-semibold text-slate-600">
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {pageData.links.length} liens trouvés
                    </span>
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {pageData.links.filter(l => !l.isExternal).length} internes
                    </span>
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {pageData.links.filter(l => l.isExternal).length} externes
                    </span>
                    {pageData.pagesCrawled && pageData.pagesCrawled > 1 && (
                      <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        {pageData.pagesCrawled} pages explorées
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap relative z-10">
                  {user && !user.isAnonymous && (
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                      <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-white rounded-md transition-all" title="Exporter en CSV">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">CSV</span>
                      </button>
                      <button onClick={handleExportJSON} className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-white rounded-md transition-all" title="Exporter en JSON">
                        <FileJson className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">JSON</span>
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !!aiAnalysis || pageData.links.length === 0}
                    className="shrink-0 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analyse...</span>
                      </>
                    ) : aiAnalysis ? (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Terminé</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Diagnostic complet</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* AI Analysis Results */}
              {aiError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-lg text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{aiError}</p>
                </div>
              )}

              {aiAnalysis && (
                <motion.div
                  key="ai-analysis"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6"
                >
                  {/* 1. Header */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Analyse de : {new URL(url).hostname}</h2>
                        <p className="text-xs text-slate-500 mt-0.5 capitalize">Type détecté : {aiAnalysis.business_type}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-xs text-slate-500 mb-0.5">Score global</div>
                        <div className={cn(
                          "text-3xl font-black",
                          aiAnalysis.score_global >= 80 ? "text-emerald-500" :
                          aiAnalysis.score_global >= 50 ? "text-amber-500" : "text-red-500"
                        )}>
                          {aiAnalysis.score_global} <span className="text-lg text-slate-300">/ 100</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={cn(
                      "p-3 rounded-lg flex items-start gap-3",
                      aiAnalysis.score_global >= 80 ? "bg-emerald-50 text-emerald-800 border border-emerald-100" :
                      aiAnalysis.score_global >= 50 ? "bg-amber-50 text-amber-800 border border-amber-100" : 
                      "bg-red-50 text-red-800 border border-red-100"
                    )}>
                      {aiAnalysis.score_global >= 80 ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> :
                       aiAnalysis.score_global >= 50 ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> :
                       <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                      <p className="text-sm font-medium">{aiAnalysis.main_message}</p>
                    </div>
                  </div>

                  {/* 2. Score détaillé */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Structure', score: aiAnalysis.scores.structure },
                      { label: 'Conversion', score: aiAnalysis.scores.conversion },
                      { label: 'Présence digitale', score: aiAnalysis.scores.presence }
                    ].map((item) => (
                      <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.score}/100</span>
                          {item.score >= 80 ? <span className="text-emerald-500 text-sm font-medium">✅ Bon</span> :
                           item.score >= 50 ? <span className="text-amber-500 text-sm font-medium">⚠️ Moyen</span> :
                           <span className="text-red-500 text-sm font-medium">❌ Faible</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Problèmes */}
                    <div className="bg-white rounded-xl border border-red-100 p-5 sm:p-6 shadow-sm">
                      <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        Problèmes détectés
                      </h3>
                      <ul className="space-y-4">
                        {aiAnalysis.problems.map((problem, idx) => (
                          <li key={idx} className="flex items-start gap-2.5">
                            <span className="text-red-500 mt-0.5 text-xs">❌</span>
                            <div>
                              <h4 className="font-semibold text-slate-900 text-sm">{problem.title}</h4>
                              <p className="text-slate-600 text-xs mt-0.5 flex items-center gap-1">
                                <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                {problem.impact}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
 
                    {/* Opportunités */}
                    <div className="bg-white rounded-xl border border-emerald-100 p-5 sm:p-6 shadow-sm">
                      <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        Opportunités
                      </h3>
                      <ul className="space-y-3">
                        {aiAnalysis.opportunities.map((opp, idx) => (
                          <li key={idx} className="flex items-start gap-2.5">
                            <span className="text-emerald-500 mt-0.5 text-xs">✅</span>
                            <span className="text-slate-700 text-sm">{opp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 5. Call-to-Action */}
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-center text-white shadow-lg">
                    <h3 className="text-xl font-bold mb-2">
                      {aiAnalysis.business_type.toLowerCase() === 'restaurant' 
                        ? "Créez votre système de réservation en 2 minutes" 
                        : "Améliorez votre site dès maintenant"}
                    </h3>
                    <p className="text-indigo-100 text-sm mb-5 max-w-lg mx-auto">
                      Ne laissez plus vos visiteurs repartir sans agir. Mettez en place les solutions recommandées pour augmenter votre taux de conversion.
                    </p>
                    {/* Remplacez le href par le lien vers votre page de contact, calendrier (Calendly) ou page de paiement */}
                    <a 
                      href="mailto:contact@votresite.com" 
                      className="bg-white text-indigo-600 hover:bg-indigo-50 font-bold py-2.5 px-6 rounded-lg transition-all hover:scale-105 shadow-md inline-flex items-center gap-2 mx-auto text-sm"
                    >
                      <Rocket className="w-4 h-4" />
                      {aiAnalysis.business_type.toLowerCase() === 'restaurant' 
                        ? "Créer mon système" 
                        : "Voir les solutions"}
                    </a>
                  </div>
                </motion.div>
              )}

              {/* Links List/Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">
                    {aiAnalysis ? 'Détail de la structure (Catégorisée)' : 'Structure brute détectée'}
                  </h3>
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        viewMode === 'list' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <ListIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        viewMode === 'grid' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {pageData.links.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                    <div className="flex justify-center">
                      <AlertCircle className="w-10 h-10 text-slate-400" />
                    </div>
                    <h4 className="text-lg font-medium text-slate-900">Aucun lien trouvé</h4>
                    <p className="text-slate-500 max-w-md mx-auto">
                      Nous n'avons trouvé aucun lien sur cette page. Cela peut arriver si le site nécessite l'exécution de JavaScript pour afficher son contenu (applications React, Vue, etc.) ou s'il bloque les accès automatisés.
                    </p>
                  </div>
                ) : aiAnalysis ? (
                  <div className="space-y-8">
                    {pageData.links.length > 800 && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                        <p>
                          <strong>Note :</strong> La page contient un très grand nombre de liens ({pageData.links.length}). Pour des raisons de performance de l'IA, seuls les 800 premiers liens ont été catégorisés.
                        </p>
                      </div>
                    )}
                    {(Object.entries(aiAnalysis.categories) as [string, ExtractedLink[]][]).map(([category, links]) => (
                      <div key={category} className="space-y-3">
                        <h4 className="font-medium text-slate-700 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                          {category} <span className="text-slate-400 text-sm font-normal">({links.length})</span>
                        </h4>
                        <LinkList links={links} viewMode={viewMode} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <h4 className="font-medium text-slate-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Pages du site (Liens internes) <span className="text-slate-400 text-sm font-normal">({pageData.links.filter(l => !l.isExternal).length})</span>
                      </h4>
                      <LinkList links={pageData.links.filter(l => !l.isExternal)} viewMode={viewMode} />
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-slate-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        Ressources externes <span className="text-slate-400 text-sm font-normal">({pageData.links.filter(l => l.isExternal).length})</span>
                      </h4>
                      <LinkList links={pageData.links.filter(l => l.isExternal)} viewMode={viewMode} />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}

        {/* History View */}
        {currentView === 'history' && (
          <HistoryView history={history} isLoading={isLoadingHistory} />
        )}

        {/* Admin View */}
        {currentView === 'admin' && isAdmin && (
          <AdminView 
            allHistory={allHistory} 
            allUsers={allUsers} 
            isLoading={isLoadingAdmin} 
            maxAnonExtractions={maxAnonExtractions}
            maxUserExtractions={maxUserExtractions}
            setMaxAnonExtractions={setMaxAnonExtractions}
            setMaxUserExtractions={setMaxUserExtractions}
            emailVerifyApiKey={emailVerifyApiKey}
            setEmailVerifyApiKey={setEmailVerifyApiKey}
          />
        )}

        {/* Mobile Bottom Navigation */}
        {isDashboardView && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex justify-around items-center h-16 px-2 pb-safe">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={cn("flex flex-col items-center justify-center w-full h-full gap-1", currentView === 'dashboard' ? "text-indigo-600" : "text-slate-500")}
            >
              <LayoutGrid className="w-5 h-5" />
              <span className="text-[10px] font-medium">Tableau de bord</span>
            </button>
            
            {user && !user.isAnonymous && (
              <button 
                onClick={() => setCurrentView('history')}
                className={cn("flex flex-col items-center justify-center w-full h-full gap-1", currentView === 'history' ? "text-indigo-600" : "text-slate-500")}
              >
                <History className="w-5 h-5" />
                <span className="text-[10px] font-medium">Historique</span>
              </button>
            )}

            {isAdmin && (
              <button 
                onClick={() => setCurrentView('admin')}
                className={cn("flex flex-col items-center justify-center w-full h-full gap-1", currentView === 'admin' ? "text-purple-600" : "text-slate-500")}
              >
                <ShieldAlert className="w-5 h-5" />
                <span className="text-[10px] font-medium">Admin</span>
              </button>
            )}
          </nav>
        )}

        {/* Quota Modal */}
        <AnimatePresence>
          {showQuotaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-6"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-slate-900">Limite atteinte</h3>
                  <p className="text-slate-500">
                    Vous avez atteint la limite de {maxAnonExtractions} extractions gratuites. Connectez-vous avec votre compte Google pour continuer à utiliser l'outil (jusqu'à {maxUserExtractions} extractions).
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowQuotaModal(false);
                      handleLogin();
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Se connecter avec Google
                  </button>
                  <button
                    onClick={() => setShowQuotaModal(false)}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                  >
                    Plus tard
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

          {/* Footer */}
          <footer className="pt-8 pb-4 border-t border-slate-200 text-center text-slate-500 text-sm flex flex-col sm:flex-row justify-between items-center gap-4 mt-12">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-slate-900 text-base">Extracteur de Liens IA</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 font-medium">
              <p>Développé par <a href="https://www.linkedin.com/in/gildas-nzikoune" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 transition-colors">Gildas NZIKOUNÉ</a></p>
              <p className="hidden sm:block text-slate-300">•</p>
              <p>© {new Date().getFullYear()} Tous droits réservés.</p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function LinkList({ links, viewMode }: { links: ExtractedLink[], viewMode: 'list' | 'grid' }) {
  if (links.length === 0) {
    return <div className="text-slate-500 text-sm italic py-4">Aucun lien trouvé dans cette catégorie.</div>;
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link, i) => (
          <a
            key={i}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 transition-all hover:shadow-md flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-slate-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                {link.text || 'Lien sans titre'}
              </span>
              {link.isExternal && <ExternalLink className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
            </div>
            <span className="text-xs text-slate-500 truncate" title={link.href}>
              {link.href}
            </span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
      {links.map((link, i) => (
        <a
          key={i}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-indigo-100 transition-colors shrink-0">
              <LinkIcon className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                {link.text || 'Lien sans titre'}
              </p>
              <p className="text-xs text-slate-500 truncate" title={link.href}>
                {link.href}
              </p>
            </div>
          </div>
          {link.isExternal && (
            <ExternalLink className="w-4 h-4 text-slate-400 shrink-0 ml-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </a>
      ))}
    </div>
  );
}


