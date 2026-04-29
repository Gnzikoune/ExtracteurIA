import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, Link as LinkIcon, ExternalLink, Loader2, Sparkles, AlertCircle, LayoutGrid, List as ListIcon, LogOut, User as UserIcon, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Rocket, FileJson, FileSpreadsheet, History, ShieldAlert, BookOpen, Menu, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, getDocs, limit, where, writeBatch } from 'firebase/firestore';

import { HistoryView } from './components/HistoryView';
import { AdminView } from './components/AdminView';
import { DocumentationView } from './components/DocumentationView';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cookie Helpers
const setCookie = (name: string, value: string, days: number) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
};

const getCookie = (name: string) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i=0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

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
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [persistentId, setPersistentId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Derived view from URL for backward compatibility with conditional rendering logic
  let currentView: 'dashboard' | 'history' | 'admin' | 'analysis' | 'documentation' = 'dashboard';
  if (location.pathname === '/history') currentView = 'history';
  else if (location.pathname === '/admin') currentView = 'admin';
  else if (location.pathname === '/docs') currentView = 'documentation';
  else if (location.pathname === '/analysis') currentView = 'analysis';

  const setCurrentView = (view: string) => {
    if (view === 'dashboard') navigate('/');
    else if (view === 'history') navigate('/history');
    else if (view === 'admin') navigate('/admin');
    else if (view === 'documentation') navigate('/docs');
    else if (view === 'analysis') navigate('/analysis');
  };

  // Auth & Usage State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userExtractions, setUserExtractions] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const isDashboardView = isAuthReady && user && !user.isAnonymous;

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
  const [showConsent, setShowConsent] = useState(false);

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
        sessionStorage.setItem('inactivityLogout', 'true');
        window.location.href = '/';
      });
    }, 300000); // 5 minutes
  }, [user]);

  useEffect(() => {
    if (sessionStorage.getItem('inactivityLogout') === 'true') {
      setError("Vous avez été déconnecté pour inactivité (5 minutes).");
      sessionStorage.removeItem('inactivityLogout');
    }
  }, []);

  useEffect(() => {
    // Initialize or retrieve persistent device ID
    let pid = localStorage.getItem('extia_pid');
    if (!pid) {
      pid = 'pid_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('extia_pid', pid);
    }
    setPersistentId(pid);
  }, []);

  useEffect(() => {
    const consent = getCookie('cookie_consent');
    if (!consent) {
      setShowConsent(true);
    } else if (consent === 'true') {
      // Re-grant consent for analytics if already accepted
      if ((window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          'ad_storage': 'granted',
          'analytics_storage': 'granted'
        });
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setHistory([]);
        setAllHistory([]);
        setAllUsers([]);
        setCurrentView('dashboard');
        
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

      // Clear UI data for anonymous users to maintain privacy as requested
      if (currentUser.isAnonymous) {
        setHistory([]);
        setAllHistory([]);
        setAllUsers([]);
        // We don't reset currentView here to avoid jumping back while the user is looking at results
      }

      setUser(currentUser);
      setIsAuthReady(true);
      
      // Fetch or create user document
    const userRef = doc(db, 'users', currentUser.uid);
    
    // If anonymous, we might want to check if we should link this session to a persistent record
    const pid = localStorage.getItem('extia_pid');
    if (currentUser.isAnonymous && pid) {
      // Sync persistent usage count if needed
      const pidRef = doc(db, 'anonymous_usage', pid);
      try {
        const pidSnap = await getDoc(pidRef);
        if (pidSnap.exists()) {
          const pidData = pidSnap.data();
          // Initialize user with persistent data
          await setDoc(userRef, {
            extractionCount: pidData.count || 0,
            lastActive: new Date().toISOString(),
            persistentId: persistentId,
            email: 'Anonyme',
            role: 'user'
          }, { merge: true });
          setUserExtractions(pidData.count || 0);
        }
      } catch (e) {
        console.error("Failed to sync persistent usage", e);
      }
    }

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
            displayName: currentUser.displayName || null,
            extractionCount: 0,
            lastActive: new Date().toISOString(),
            role: currentUser.email === 'gnzikoune@gmail.com' ? 'admin' : 'user',
            ...(emailStatus ? { emailStatus } : {})
          });
          setUserExtractions(0);
          setIsAdmin(currentUser.email === 'gnzikoune@gmail.com');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
        }
      } else {
        // Update user info
        try {
          await setDoc(userRef, { 
            lastActive: new Date().toISOString(),
            displayName: currentUser.displayName || userSnap.data().displayName || null,
            ...(emailStatus === 'ok' ? { emailStatus: 'ok' } : {})
          }, { merge: true });
        } catch (e) {
          console.error("Failed to update user info", e);
        }
        setUserExtractions(userSnap.data().extractionCount || 0);
        setIsAdmin(currentUser.email === 'gnzikoune@gmail.com' || userSnap.data().role === 'admin');
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
      setHistory([]);
      setAllHistory([]);
      setAllUsers([]);
      setCurrentView('dashboard');
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
      const q = query(
        collection(db, 'analyses'), 
        where('url', '==', normalizedUrl.substring(0, 1999)),
        where('userId', '==', user.uid),
        limit(1)
      );
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

          // Also update persistent storage for anonymous users
          if (user.isAnonymous && persistentId) {
            await setDoc(doc(db, 'anonymous_usage', persistentId), {
              count: newCount,
              lastActive: new Date().toISOString()
            }, { merge: true });
          }

          setUserExtractions(newCount);

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

  const handleAnalyze = async (manualData?: { url: string, pageData: PageData, analysisId: string }) => {
    const activeUrl = manualData?.url || url;
    const activePageData = manualData?.pageData || pageData;
    const activeAnalysisId = manualData?.analysisId || currentAnalysisId;

    if (!activePageData || activePageData.links.length === 0) return;

    setIsAnalyzing(true);
    setAiError(null);

    try {
      const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('La clé API Gemini n\'est pas configurée');
      }

      // DEBUG: Afficher les 4 premiers caractères de la clé utilisée
      console.log(`Utilisation de la clé API Gemini: ${apiKey.substring(0, 4)}...`);

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Analyze the following webpage and its extracted links to provide a business conversion diagnostic.
        URL: ${activeUrl}
        Title: ${activePageData.title}
        Description: ${activePageData.description}
        
        Total Links: ${activePageData.links.length}
        Links Data:
        ${JSON.stringify(activePageData.links.slice(0, 800).map((l, index) => ({ id: index, text: l.text, href: l.href })))}
        
        Please provide a comprehensive business diagnostic of this webpage based on its metadata and links:
        
        1. "score_global": A score out of 100 representing the overall conversion potential.
        2. "main_message": A single, impactful sentence summarizing the main issue or opportunity (e.g., "⚠️ Votre site présente plusieurs points qui peuvent vous faire perdre des clients"). (IN FRENCH)
        3. "scores": Provide sub-scores out of 100 for "structure", "conversion", and "presence" (digital presence).
        4. "problems": Identify 3 to 5 main business weaknesses based on the links (e.g., missing booking page, confusing navigation). For each, provide a "title" (the problem) and "impact" (the business consequence, e.g., "Vous perdez des clients prêts à passer à l'action"). (IN FRENCH)
        5. "opportunities": Provide 2 to 4 concrete, actionable improvements. (IN FRENCH)
        6. "business_type": Guess the type of business (e.g., "restaurant", "e-commerce", "blog", "agence", "inconnu"). (IN FRENCH)
        7. "categories": Categorize ALL the provided links into meaningful groups (e.g., "Navigation du site", "Réseaux Sociaux", "Articles", "Ressources Externes", etc.). 
           IMPORTANT: To save space, return the "id" of each link in the corresponding category array. EVERY single link id from 0 to ${Math.min(activePageData.links.length, 800) - 1} MUST be placed in exactly one category. (IN FRENCH)
        
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
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        
        // Map back to ExtractedLink format using the returned indices
        const categories: Record<string, ExtractedLink[]> = {};
        for (const [category, linkIds] of Object.entries(parsed.categories)) {
          categories[category] = (linkIds as number[])
            .map(id => activePageData.links[id])
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
        if (activeAnalysisId && user) {
          try {
            // Store the link IDs for each category to allow reconstruction later
            const categoriesFull: Record<string, number[]> = {};
            for (const [cat, catLinks] of Object.entries(categories)) {
              // We find the original indices of these links in activePageData.links
              categoriesFull[cat] = catLinks.map(l => 
                activePageData.links.findIndex(orig => orig.href === l.href)
              ).filter(idx => idx !== -1);
            }

            await setDoc(doc(db, 'analyses', activeAnalysisId), {
              ai: {
                scoreGlobal: aiResult.score_global,
                mainMessage: aiResult.main_message,
                scores: aiResult.scores,
                problems: aiResult.problems,
                opportunities: aiResult.opportunities,
                businessType: aiResult.business_type,
                categories: categoriesFull
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
      
      let friendlyMessage = "Échec de l'analyse avec l'IA.";
      const errorStr = err.toString();
      const message = err.message || "";

      if (message.includes('503') || errorStr.includes('503')) {
        friendlyMessage = "⚠️ Le service est actuellement surchargé (High Demand). Google limite temporairement les accès. Veuillez réessayer dans 30 secondes.";
      } else if (message.includes('429') || errorStr.includes('429')) {
        friendlyMessage = isAdmin 
          ? "🚫 Quota épuisé ou trop de requêtes. Vérifiez vos limites dans Google AI Studio ou patientez une minute."
          : "🚫 Le service est très sollicité et a atteint sa limite temporaire. Veuillez réessayer dans quelques minutes.";
      } else if (message.includes('400') || errorStr.includes('400')) {
        friendlyMessage = "❌ Requête invalide. La page est peut-être trop complexe pour l'analyse automatique.";
      } else if (message.includes('API key') || errorStr.includes('API key')) {
        friendlyMessage = isAdmin
          ? "🔑 Problème de clé API. Veuillez vérifier la clé Gemini dans l'onglet Administration."
          : "🔑 Service temporairement indisponible (Configuration). L'administrateur doit mettre à jour la clé API.";
      } else {
        friendlyMessage = message || friendlyMessage;
      }

      setAiError(friendlyMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteHistory = async (ids: string[]) => {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.delete(doc(db, 'analyses', id));
      });
      await batch.commit();
      
      // Update local state to avoid waiting for re-fetch
      setHistory(prev => prev.filter(item => !ids.includes(item.id)));
      setAllHistory(prev => prev.filter(item => !ids.includes(item.id)));
    } catch (error) {
      console.error("Failed to delete history:", error);
      alert("Erreur lors de la suppression de l'historique.");
    }
  };

  const handleDeleteUser = async (ids: string[]) => {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.delete(doc(db, 'users', id));
      });
      await batch.commit();
      
      setAllUsers(prev => prev.filter(u => !ids.includes(u.id)));
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Erreur lors de la suppression de l'utilisateur.");
    }
  };

  const handleScoreFromHistory = (item: any) => {
    const manualData = {
      url: item.url,
      pageData: {
        title: item.raw.title,
        description: item.raw.description,
        links: item.raw.links,
        pagesCrawled: item.raw.pagesCrawled
      },
      analysisId: item.id
    };
    
    // Set states to display correctly on dashboard
    setUrl(manualData.url);
    setPageData(manualData.pageData);
    setCurrentAnalysisId(manualData.analysisId);
    setAiAnalysis(null);
    setCurrentView('analysis');
    
    // If analysis already exists, use it instead of re-running
    if (item.ai) {
      const categories: Record<string, ExtractedLink[]> = {};
      if (item.ai.categories) {
        for (const [cat, indices] of Object.entries(item.ai.categories)) {
          if (Array.isArray(indices)) {
            categories[cat] = indices
              .map(idx => manualData.pageData.links[idx])
              .filter(Boolean);
          }
        }
      }

      setAiAnalysis({
        score_global: item.ai.scoreGlobal,
        main_message: item.ai.mainMessage,
        scores: item.ai.scores,
        problems: item.ai.problems,
        opportunities: item.ai.opportunities,
        business_type: item.ai.businessType,
        categories
      });
    } else {
      // Only trigger analysis if it doesn't exist yet
      handleAnalyze(manualData);
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

  const renderMainContent = () => (
    <>

      {/* Top Dashboard Stats */}
      {isAuthReady && user && !user.isAnonymous && location.pathname === '/' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="font-semibold text-slate-600 text-sm">Extractions utilisées</h3>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-3 relative z-10">
              <span className="text-2xl font-black text-slate-900">{userExtractions}</span>
              <span className="text-slate-500 text-xs font-medium">/ {maxUserExtractions}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative z-10">
              <div 
                className={cn("h-full rounded-full transition-all", userExtractions >= maxUserExtractions ? "bg-red-500" : "bg-indigo-600")}
                style={{ width: `${Math.min((userExtractions / maxUserExtractions) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="font-semibold text-slate-600 text-sm">Compte</h3>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <UserIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-lg font-bold text-slate-900 mb-0.5 truncate">{user.displayName || 'Connecté'}</p>
              <p className="text-xs font-medium text-slate-500 truncate">{user.email}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="font-semibold text-slate-600 text-sm">IA Moteur</h3>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Rocket className="w-5 h-5" />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-lg font-bold text-slate-900 mb-0.5">Gemini 1.5</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-medium text-slate-500">Actif</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis Logic */}
      <div className="space-y-8">
        {!pageData && (location.pathname === '/' || location.pathname === '/analysis') && (
          <section className="relative overflow-hidden rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-800 p-5 sm:p-8 lg:p-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>
            <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight"
              >
                Analysez les liens de <br/><span className="text-indigo-400">n'importe quelle URL</span>
              </motion.h1>
              <p className="text-base text-slate-300 max-w-2xl mx-auto">
                Outil gratuit pour extraire les liens d'une page web et obtenir un diagnostic IA complet de votre structure.
              </p>
              
              <form onSubmit={handleExtract} className="mt-8 p-2 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl relative flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type="url" 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    placeholder="https://exemple.com" 
                    required 
                    className="block w-full pl-12 pr-4 py-4 bg-white border-transparent rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/30" 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                  <span>{isLoading ? 'Extraction...' : 'Diagnostiquer'}</span>
                </button>
              </form>
              {error && <div className="text-red-400 text-sm mt-4 bg-red-900/20 p-3 rounded-lg border border-red-900/30">{error}</div>}
              
              <div className="pt-8 flex flex-wrap justify-center gap-8 text-slate-400 text-sm font-medium">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Extraction instantanée</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Audit IA Gemini</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Export CSV/JSON</div>
              </div>
            </div>
          </section>
        )}

        {pageData && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row gap-6 justify-between items-center">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-slate-900 truncate">{pageData.title}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-1">{url}</p>
                <div className="flex gap-2 mt-3">
                  <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600">{pageData.links.length} liens</span>
                  <span className="bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-600">{pageData.links.filter(l => !l.isExternal).length} internes</span>
                  <span className="bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-600">{pageData.links.filter(l => l.isExternal).length} externes</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={() => { setPageData(null); setAiAnalysis(null); }} 
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
                >
                  Nouvelle analyse
                </button>
                <button 
                  onClick={() => { if(user?.isAnonymous) setShowLoginModal(true); else handleAnalyze(); }} 
                  disabled={isAnalyzing || (!!aiAnalysis && !user?.isAnonymous)} 
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiAnalysis && !user?.isAnonymous ? 'Audit terminé' : 'Lancer l\'audit IA'}
                </button>
              </div>
            </div>

            {aiAnalysis && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-xl flex flex-col md:flex-row gap-6 sm:gap-8 items-center border border-slate-800">
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-black mb-2 sm:mb-4">Diagnostic IA : {aiAnalysis.score_global}/100</h2>
                    <p className="text-indigo-200 italic opacity-90 text-xs sm:text-sm lg:text-base leading-relaxed">"{aiAnalysis.main_message}"</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 sm:gap-6 w-full md:w-auto border-t border-white/10 md:border-t-0 pt-6 md:pt-0">
                    <div className="text-center"><span className="block text-xl sm:text-2xl font-bold">{aiAnalysis.scores.structure}</span><span className="text-[9px] sm:text-[10px] uppercase font-bold opacity-50">Structure</span></div>
                    <div className="text-center"><span className="block text-xl sm:text-2xl font-bold">{aiAnalysis.scores.conversion}</span><span className="text-[9px] sm:text-[10px] uppercase font-bold opacity-50">Conversion</span></div>
                    <div className="text-center"><span className="block text-xl sm:text-2xl font-bold">{aiAnalysis.scores.presence}</span><span className="text-[9px] sm:text-[10px] uppercase font-bold opacity-50">Présence</span></div>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border border-red-100 p-4">
                    <h4 className="font-bold mb-4 flex items-center gap-2 text-red-600 text-sm"><AlertCircle className="w-4 h-4" /> Points de friction</h4>
                    <ul className="space-y-3">
                      {aiAnalysis.problems.map((p, i) => (
                        <li key={i}><span className="font-semibold text-slate-800 text-sm">{p.title}</span><p className="text-slate-500 text-xs mt-1">{p.impact}</p></li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg border border-emerald-100 p-4">
                    <h4 className="font-bold mb-4 flex items-center gap-2 text-emerald-600 text-sm"><Sparkles className="w-4 h-4" /> Opportunités</h4>
                    <ul className="space-y-3">
                      {aiAnalysis.opportunities.map((o, i) => (
                        <li key={i} className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{o}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Structure des liens détectée</h3>
                <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
                  <button onClick={() => setViewMode('list')} className={cn("p-1.5 rounded-md", viewMode === 'list' ? "bg-slate-100" : "text-slate-400")}><ListIcon className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('grid')} className={cn("p-1.5 rounded-md", viewMode === 'grid' ? "bg-slate-100" : "text-slate-400")}><LayoutGrid className="w-4 h-4" /></button>
                </div>
              </div>
              {aiAnalysis ? (
                <div className="space-y-8">
                  {(Object.entries(aiAnalysis.categories) as [string, ExtractedLink[]][]).map(([cat, links]) => (
                    <div key={cat} className="space-y-3">
                      <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"/>{cat} ({links.length})
                      </h4>
                      <LinkList links={links} viewMode={viewMode} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-3"><h4 className="font-semibold text-slate-700">Liens Internes</h4><LinkList links={pageData.links.filter(l => !l.isExternal)} viewMode={viewMode} /></div>
                  <div className="space-y-3"><h4 className="font-semibold text-slate-700">Liens Externes</h4><LinkList links={pageData.links.filter(l => l.isExternal)} viewMode={viewMode} /></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={cn("min-h-screen bg-slate-50 text-slate-900 font-sans", isDashboardView ? "flex flex-col md:flex-row" : "flex flex-col")}>
      <Helmet>
        <title>ExtracteurIA | Audit SEO & Link Extractor AI</title>
        <meta name="description" content="Outil gratuit pour extraire les liens d'une URL et obtenir un diagnostic IA complet." />
      </Helmet>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && isDashboardView && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[40] md:hidden"
            />
            <motion.aside 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white shadow-2xl z-[50] md:hidden flex flex-col"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
                <div className="flex items-center">
                  <div className="bg-indigo-600 p-1.5 rounded-lg text-white mr-3"><LinkIcon className="w-5 h-5" /></div>
                  <h1 className="font-bold text-lg tracking-tight">Extracteur<span className="text-indigo-600">IA</span></h1>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1">
                {[
                  { to: "/", icon: LayoutGrid, label: "Dashboard" },
                  { to: "/history", icon: History, label: "Historique" },
                  { to: "/admin", icon: ShieldAlert, label: "Administration", adminOnly: true },
                  { to: "/docs", icon: BookOpen, label: "Documentation" }
                ].map((item) => (
                  (!item.adminOnly || isAdmin) && (
                    <Link 
                      key={item.to}
                      to={item.to} 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-sm",
                        location.pathname === item.to ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <item.icon className="w-5 h-5" /> {item.label}
                    </Link>
                  )
                ))}
              </nav>
              <div className="p-4 border-t border-slate-200">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  {user?.photoURL ? (
                    <img src={user.photoURL} className="w-10 h-10 rounded-full border border-white shadow-sm" alt="profile"/>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">{user?.email?.[0].toUpperCase()}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-slate-900">{user?.displayName || 'Utilisateur'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop - Only for Auth Users) */}
      {isDashboardView && (
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed inset-y-0 z-20">
          <div className="h-16 flex items-center px-6 border-b border-slate-200">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white mr-3"><LinkIcon className="w-5 h-5" /></div>
            <h1 className="font-bold text-lg tracking-tight">Extracteur<span className="text-indigo-600">IA</span></h1>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <Link to="/" className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all", location.pathname === '/' ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-slate-50")}>
              <LayoutGrid className="w-5 h-5" /> Dashboard
            </Link>
            <Link to="/history" className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all", location.pathname === '/history' ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-slate-50")}>
              <History className="w-5 h-5" /> Historique
            </Link>
            {isAdmin && (
              <Link to="/admin" className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all", location.pathname === '/admin' ? "bg-purple-50 text-purple-700 shadow-sm" : "text-slate-600 hover:bg-slate-50")}>
                <ShieldAlert className="w-5 h-5" /> Administration
              </Link>
            )}
            <Link to="/docs" className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all", location.pathname === '/docs' ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-50")}>
              <BookOpen className="w-5 h-5" /> Documentation
            </Link>
          </nav>
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
              {user?.photoURL ? (
                <img src={user.photoURL} className="w-10 h-10 rounded-full border border-white shadow-sm" alt="profile"/>
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">{user?.email?.[0].toUpperCase()}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-slate-900">{user?.displayName || 'Utilisateur'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={cn("flex-1 flex flex-col", isDashboardView ? "md:ml-64" : "")}>
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isDashboardView && (
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Menu className="w-6 h-6" />
                </button>
              )}
              {!isDashboardView && (
                <>
                  <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><LinkIcon className="w-5 h-5" /></div>
                  <h1 className="font-bold text-xl tracking-tight">Extracteur<span className="text-indigo-600">IA</span></h1>
                </>
              )}
              {isDashboardView && (
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-600 p-1 rounded-lg text-white md:hidden"><LinkIcon className="w-5 h-5" /></div>
                  <span className="font-bold md:text-lg">
                    {location.pathname === '/' ? 'Dashboard' : 
                     location.pathname === '/history' ? 'Historique' :
                     location.pathname === '/admin' ? 'Admin' :
                     location.pathname === '/docs' ? 'Documentation' : 'ExtracteurIA'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {isAuthReady && (!user || user.isAnonymous) ? (
                <button 
                  onClick={handleLogin} 
                  className="px-4 sm:px-5 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs sm:text-sm hover:bg-slate-800 transition-all shadow-md active:scale-95 whitespace-nowrap"
                >
                  Se connecter
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-indigo-50 px-2 sm:px-3 py-1.5 rounded-full text-indigo-700 text-[10px] sm:text-xs font-bold border border-indigo-100">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="hidden xs:inline">Quota :</span> {userExtractions}/{maxUserExtractions}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<div className="max-w-6xl mx-auto">{renderMainContent()}</div>} />
            <Route path="/analysis" element={<div className="max-w-6xl mx-auto"><Helmet><title>Analyse - ExtracteurIA</title></Helmet>{renderMainContent()}</div>} />
            <Route path="/history" element={<div className="max-w-6xl mx-auto"><HistoryView history={history} isLoading={isLoadingHistory} onScore={handleScoreFromHistory} onDelete={handleDeleteHistory} /></div>} />
            <Route path="/admin" element={isAdmin ? <div className="max-w-6xl mx-auto"><AdminView allHistory={allHistory} allUsers={allUsers} isLoading={isLoadingAdmin} maxAnonExtractions={maxAnonExtractions} maxUserExtractions={maxUserExtractions} setMaxAnonExtractions={setMaxAnonExtractions} setMaxUserExtractions={setMaxUserExtractions} emailVerifyApiKey={emailVerifyApiKey} setEmailVerifyApiKey={setEmailVerifyApiKey} geminiApiKey={geminiApiKey} setGeminiApiKey={setGeminiApiKey} onScore={handleScoreFromHistory} onDeleteHistory={handleDeleteHistory} onDeleteUser={handleDeleteUser} /></div> : <Navigate to="/" />} />
            <Route path="/docs" element={<div className="max-w-6xl mx-auto"><DocumentationView maxUserExtractions={maxUserExtractions} maxAnonExtractions={maxAnonExtractions} /></div>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <footer className="max-w-6xl mx-auto w-full px-6 py-12 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-6 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-900">Extracteur de Liens IA</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 font-medium">
            <p>© {new Date().getFullYear()} Gildas NZIKOUNÉ. Tous droits réservés.</p>
          </div>
        </footer>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showQuotaModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQuotaModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle className="w-8 h-8" /></div>
              <h3 className="text-2xl font-bold mb-3 text-slate-900">Limite atteinte</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">Vous avez atteint la limite de {maxAnonExtractions} analyses gratuites. Connectez-vous pour débloquer jusqu'à {maxUserExtractions} diagnostics IA.</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => { setShowQuotaModal(false); handleLogin(); }} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">Se connecter avec Google</button>
                <button onClick={() => setShowQuotaModal(false)} className="w-full py-4 bg-slate-50 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all">Plus tard</button>
              </div>
            </motion.div>
          </div>
        )}
        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLoginModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6"><Sparkles className="w-8 h-8" /></div>
              <h3 className="text-2xl font-bold mb-3 text-slate-900">Diagnostic IA Premium</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">Le rapport complet par intelligence artificielle nécessite un compte. Connectez-vous gratuitement pour auditer votre site.</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => { setShowLoginModal(false); handleLogin(); }} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl shadow-lg hover:opacity-90 transition-all">Créer un compte gratuit</button>
                <button onClick={() => setShowLoginModal(false)} className="w-full py-4 bg-slate-50 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all">Continuer sans l'IA</button>
              </div>
            </motion.div>
          </div>
        )}
        {showConsent && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 z-[200] md:left-auto md:max-w-md"
          >
            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-xl bg-opacity-95 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Consentement aux données</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Ce site a besoin de votre consentement pour utiliser vos données. Nous utilisons des cookies pour améliorer votre expérience et analyser notre trafic.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { 
                    setCookie('cookie_consent', 'true', 365); 
                    setShowConsent(false);
                    // Update GA consent
                    if ((window as any).gtag) {
                      (window as any).gtag('consent', 'update', {
                        'ad_storage': 'granted',
                        'analytics_storage': 'granted'
                      });
                    }
                  }}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Accepter
                </button>
                <button 
                  onClick={() => setShowConsent(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LinkList({ links, viewMode }: { links: ExtractedLink[], viewMode: 'list' | 'grid' }) {
  if (links.length === 0) return <div className="text-slate-400 text-sm italic py-4">Aucun lien trouvé.</div>;
  
  if (viewMode === 'grid') return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {links.map((link, i) => (
        <a key={i} href={link.href} target="_blank" rel="noopener noreferrer" className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 transition-all hover:shadow-md flex flex-col gap-2 group">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-slate-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">{link.text || 'Lien sans texte'}</span>
            {link.isExternal && <ExternalLink className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
          </div>
          <span className="text-xs text-slate-400 truncate">{link.href}</span>
        </a>
      ))}
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-sm">
      {links.map((link, i) => (
        <a key={i} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 group transition-colors min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 transition-colors shrink-0">
              <LinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors text-sm sm:text-base">{link.text || 'Lien sans texte'}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">{link.href}</p>
            </div>
          </div>
          {link.isExternal && <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200 ml-3 sm:ml-4 shrink-0" />}
        </a>
      ))}
    </div>
  );
}
