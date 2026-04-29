import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Settings, Users, Database, Save, CheckCircle2, History, Sparkles, Eye, EyeOff, Trash2, CheckSquare, Square, AlertCircle, ExternalLink, BarChart2 } from 'lucide-react';
import { doc, setDoc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function AdminView({ 
  allHistory, 
  allUsers, 
  isLoading, 
  maxAnonExtractions, 
  maxUserExtractions, 
  setMaxAnonExtractions, 
  setMaxUserExtractions,
  emailVerifyApiKey,
  setEmailVerifyApiKey,
  geminiApiKey,
  setGeminiApiKey,
  onScore,
  onDeleteHistory,
  onDeleteUser
}: { 
  allHistory: any[], 
  allUsers: any[], 
  isLoading: boolean, 
  maxAnonExtractions: number, 
  maxUserExtractions: number, 
  setMaxAnonExtractions: (val: number) => void, 
  setMaxUserExtractions: (val: number) => void, 
  emailVerifyApiKey: string | null, 
  setEmailVerifyApiKey: (val: string | null) => void, 
  geminiApiKey: string | null, 
  setGeminiApiKey: (val: string | null) => void, 
  onScore: (item: any) => void,
  onDeleteHistory: (ids: string[]) => void,
  onDeleteUser: (ids: string[]) => void
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [emailApiKey, setEmailApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showEmailKey, setShowEmailKey] = useState(false);
  
  // Selection states
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'user' | 'history', ids: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'audience' | 'users' | 'history'>('settings');
  
  // Analytics states
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  // Synchronize local state with props when they are loaded from Firestore
  React.useEffect(() => {
    if (geminiApiKey) setApiKey(geminiApiKey);
    if (emailVerifyApiKey) setEmailApiKey(emailVerifyApiKey);
  }, [geminiApiKey, emailVerifyApiKey]);

  // Fetch Analytics
  React.useEffect(() => {
    setIsLoadingAnalytics(true);
    
    // Fetch last 7 days of stats
    const statsQuery = query(collection(db, 'analytics_stats'), orderBy('updatedAt', 'desc'), limit(7));
    const unsubscribeStats = onSnapshot(statsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        date: doc.id,
        ...doc.data()
      })).reverse();
      setAnalyticsData(data);
      setIsLoadingAnalytics(false);
    });

    // Fetch last 20 events
    const eventsQuery = query(collection(db, 'analytics_events'), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecentEvents(data);
    });

    return () => {
      unsubscribeStats();
      unsubscribeEvents();
    };
  }, []);

  // Only show users with an email address
  const usersWithEmail = allUsers.filter(u => u.email && u.email !== 'Anonyme');

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const dataToSave: any = {
        maxAnonExtractions,
        maxUserExtractions,
        updatedAt: new Date().toISOString()
      };
      if (apiKey) dataToSave.geminiApiKey = apiKey;
      if (emailApiKey) dataToSave.emailVerifyApiKey = emailApiKey;
      
      await setDoc(doc(db, 'settings', 'global'), dataToSave, { merge: true });
      
      // Update global state
      if (apiKey) setGeminiApiKey(apiKey);
      if (emailApiKey) setEmailVerifyApiKey(emailApiKey);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Erreur lors de la sauvegarde des paramètres.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUserSelect = (id: string) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAllUsers = () => {
    setSelectedUsers(selectedUsers.length === usersWithEmail.length ? [] : usersWithEmail.map(u => u.id));
  };

  const toggleHistorySelect = (id: string) => {
    setSelectedHistory(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAllHistory = () => {
    setSelectedHistory(selectedHistory.length === allHistory.length ? [] : allHistory.map(h => h.id));
  };

  const executeDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'user') {
      onDeleteUser(confirmDelete.ids);
      setSelectedUsers(prev => prev.filter(id => !confirmDelete.ids.includes(id)));
    } else {
      onDeleteHistory(confirmDelete.ids);
      setSelectedHistory(prev => prev.filter(id => !confirmDelete.ids.includes(id)));
    }
    setConfirmDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
        <p>Chargement des données d'administration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header + Tab Navigation */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Settings className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Administration</h2>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
          {[
            { id: 'settings', label: 'Paramètres', icon: Settings },
            { id: 'audience', label: 'Audience', icon: BarChart2 },
            { id: 'users', label: `Utilisateurs (${usersWithEmail.length})`, icon: Users },
            { id: 'history', label: `Historique (${allHistory.length})`, icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SETTINGS TAB ─────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-sm"
        >
          <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-500" />
            Paramètres globaux
          </h3>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Limite d'extractions (Anonymes)
                </label>
                <input 
                  type="number" 
                  min="0"
                  value={maxAnonExtractions}
                  onChange={(e) => setMaxAnonExtractions(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Limite d'extractions (Connectés)
                </label>
                <input 
                  type="number" 
                  min="0"
                  value={maxUserExtractions}
                  onChange={(e) => setMaxUserExtractions(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Clé API Gemini (Optionnel)
                </label>
                <div className="relative">
                  <input 
                    type={showGeminiKey ? "text" : "password"} 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Laisser vide pour ne pas modifier"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Clé API EmailListVerify (Optionnel)
                </label>
                <div className="relative">
                  <input 
                    type={showEmailKey ? "text" : "password"} 
                    value={emailApiKey}
                    onChange={(e) => setEmailApiKey(e.target.value)}
                    placeholder="Laisser vide pour ne pas modifier"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailKey(!showEmailKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showEmailKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder les paramètres
            </button>
            
            {saveSuccess && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg text-sm justify-center">
                <CheckCircle2 className="w-4 h-4" />
                Paramètres sauvegardés avec succès
              </div>
            )}
          </form>
        </motion.div>

        {/* Stats Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col gap-6"
        >
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" />
            Statistiques globales
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
              <Users className="w-6 h-6 text-indigo-400 mb-2" />
              <p className="text-2xl font-black text-slate-900">{usersWithEmail.length}</p>
              <p className="text-xs font-medium text-slate-500">Utilisateurs inscrits</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
              <Database className="w-6 h-6 text-purple-400 mb-2" />
              <p className="text-2xl font-black text-slate-900">{allHistory.length}</p>
              <p className="text-xs font-medium text-slate-500">Analyses générées</p>
            </div>
          </div>
        </motion.div>
        </div>
      )}

      {/* ── AUDIENCE TAB ─────────────────────────────── */}
      {activeTab === 'audience' && (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            Analyses d'Audience (Interne)
          </h3>
          <div className="flex gap-2">
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase tracking-wider">7 derniers jours</span>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-[250px] w-full">
                {analyticsData.length === 0 || analyticsData.every(d => !d.pageViews && !d.extractions) ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                    <BarChart2 className="w-10 h-10 opacity-20" />
                    <div className="text-center">
                      <p className="text-sm font-semibold">En attente de données</p>
                      <p className="text-xs mt-1 text-slate-400">Le graphique se remplira au fil des visites</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="pageViews" name="Vues" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="extractions" name="Extractions" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {/* Stats summary row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-indigo-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-indigo-700">{analyticsData.reduce((sum, d) => sum + (d.pageViews || 0), 0)}</p>
                  <p className="text-[10px] text-indigo-500 font-medium">Vues totales</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-emerald-700">{analyticsData.reduce((sum, d) => sum + (d.extractions || 0), 0)}</p>
                  <p className="text-[10px] text-emerald-500 font-medium">Extractions</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-orange-700">{analyticsData.reduce((sum, d) => sum + (d.errors || 0), 0)}</p>
                  <p className="text-[10px] text-orange-500 font-medium">Erreurs</p>
                </div>
              </div>
              <div className="flex justify-center gap-6 text-xs font-medium">
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-indigo-500 rounded-full"></span> Vues de pages</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> Analyses réussies</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Activité récente</h4>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={cn(
                      "mt-0.5 w-2 h-2 rounded-full shrink-0",
                      event.event === 'extraction_completed' ? "bg-emerald-500" : 
                      event.event === 'extraction_failed' ? "bg-red-500" : "bg-indigo-400"
                    )} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {event.event === 'page_view' ? 'Vue de page' : 
                         event.event === 'extraction_completed' ? 'Extraction réussie' :
                         event.event === 'extraction_failed' ? 'Échec extraction' : event.event}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{event.url || event.path || 'ExtracteurIA'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {/* ── USERS TAB ─────────────────────────────── */}
      {activeTab === 'users' && (
      <>{/* Users List */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            Liste des utilisateurs
          </h3>
          {selectedUsers.length > 0 && (
            <button 
              onClick={() => setConfirmDelete({ type: 'user', ids: selectedUsers })}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold border border-red-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer ({selectedUsers.length})
            </button>
          )}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 w-10">
                  <button onClick={toggleAllUsers} className="text-slate-400 hover:text-indigo-600">
                    {selectedUsers.length === usersWithEmail.length && usersWithEmail.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Nom</th>
                <th className="px-6 py-4">Rôle</th>
                <th className="px-6 py-4">Extractions</th>
                <th className="px-6 py-4">Dernière connexion</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersWithEmail.map(u => (
                <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${selectedUsers.includes(u.id) ? 'bg-indigo-50/30' : ''}`}>
                  <td className="px-4 py-4">
                    <button onClick={() => toggleUserSelect(u.id)} className={selectedUsers.includes(u.id) ? 'text-indigo-600' : 'text-slate-300'}>
                      {selectedUsers.includes(u.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{u.email}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium">{u.displayName || <span className="text-slate-300 italic text-xs">Non renseigné</span>}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                      {u.role || 'user'}
                    </span>
                  </td>
                  <td className="px-6 py-4">{u.extractionCount || 0}</td>
                  <td className="px-6 py-4">
                    {u.lastActive ? new Date(u.lastActive.toDate ? u.lastActive.toDate() : u.lastActive).toLocaleDateString('fr-FR') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setConfirmDelete({ type: 'user', ids: [u.id] })}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {usersWithEmail.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">Aucun utilisateur trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Mobile View for Users */}
        <div className="md:hidden divide-y divide-slate-100">
          {usersWithEmail.map(u => (
            <div key={u.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleUserSelect(u.id)} className={selectedUsers.includes(u.id) ? 'text-indigo-600' : 'text-slate-300'}>
                    {selectedUsers.includes(u.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{u.email}</p>
                    <p className="text-xs text-slate-500">{u.displayName || 'Sans nom'}</p>
                  </div>
                </div>
                <button onClick={() => setConfirmDelete({ type: 'user', ids: [u.id] })} className="p-2 text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className={`px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                  {u.role || 'user'}
                </span>
                <span className="text-slate-500">{u.extractionCount || 0} extractions</span>
              </div>
            </div>
          ))}
          {usersWithEmail.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Aucun utilisateur trouvé.</div>}
        </div>
      </motion.div>
      </>
      )}

      {/* ── HISTORY TAB ─────────────────────────────── */}
      {activeTab === 'history' && (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            Historique complet des analyses
          </h3>
          {selectedHistory.length > 0 && (
            <button 
              onClick={() => setConfirmDelete({ type: 'history', ids: selectedHistory })}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold border border-red-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer ({selectedHistory.length})
            </button>
          )}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 w-10">
                  <button onClick={toggleAllHistory} className="text-slate-400 hover:text-indigo-600">
                    {selectedHistory.length === allHistory.length && allHistory.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-6 py-4">URL</th>
                <th className="px-6 py-4">Utilisateur</th>
                <th className="px-6 py-4">Score</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allHistory.map(h => (
                <tr key={h.id} className={`hover:bg-slate-50 transition-colors ${selectedHistory.includes(h.id) ? 'bg-indigo-50/30' : ''}`}>
                  <td className="px-4 py-4">
                    <button onClick={() => toggleHistorySelect(h.id)} className={selectedHistory.includes(h.id) ? 'text-indigo-600' : 'text-slate-300'}>
                      {selectedHistory.includes(h.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900 max-w-[150px] truncate">
                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 flex items-center gap-1">
                      {new URL(h.url).hostname}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${h.isAnonymous ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                      {h.isAnonymous ? 'Anon' : (h.userId?.slice(0, 8) || 'User')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {h.ai?.scoreGlobal !== undefined ? (
                      <span className={`font-black ${h.ai.scoreGlobal >= 70 ? 'text-emerald-500' : h.ai.scoreGlobal >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                        {h.ai.scoreGlobal}
                      </span>
                    ) : (
                      <button onClick={() => onScore(h)} className="text-indigo-600 hover:scale-105 transition-transform"><Sparkles className="w-4 h-4" /></button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium">{h.ai?.businessType || 'N/A'}</td>
                  <td className="px-6 py-4 text-xs whitespace-nowrap">
                    {h.createdAt ? new Date(h.createdAt.toDate ? h.createdAt.toDate() : h.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setConfirmDelete({ type: 'history', ids: [h.id] })}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View for History */}
        <div className="md:hidden divide-y divide-slate-100">
          {allHistory.map(h => (
            <div key={h.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <button onClick={() => toggleHistorySelect(h.id)} className={`mt-1 ${selectedHistory.includes(h.id) ? 'text-indigo-600' : 'text-slate-300'}`}>
                    {selectedHistory.includes(h.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                  <div className="min-w-0">
                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-900 truncate block hover:text-indigo-600">
                      {new URL(h.url).hostname}
                    </a>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {h.createdAt ? new Date(h.createdAt.toDate ? h.createdAt.toDate() : h.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {h.ai?.scoreGlobal !== undefined ? (
                    <span className={`text-lg font-black ${(h.ai.scoreGlobal || 0) >= 70 ? 'text-emerald-500' : (h.ai.scoreGlobal || 0) >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                      {h.ai.scoreGlobal}
                    </span>
                  ) : (
                    <button onClick={() => onScore(h)} className="text-indigo-600"><Sparkles className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => setConfirmDelete({ type: 'history', ids: [h.id] })} className="p-1 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${h.isAnonymous ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                  {h.isAnonymous ? 'Anon' : (h.userId?.slice(0, 8) || 'User')}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{h.ai?.businessType || 'N/A'}</span>
              </div>
            </div>
          ))}
          {allHistory.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Aucun historique trouvé.</div>}
        </div>
      </motion.div>
      )}

      {/* Confirmation Modal — always rendered */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
            >
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmer la suppression ?</h3>
              <p className="text-slate-500 mb-6 text-sm">
                Cette action supprimera définitivement {confirmDelete.ids.length > 1 ? `ces ${confirmDelete.ids.length} ${confirmDelete.type === 'user' ? 'utilisateurs' : 'analyses'}` : `cet ${confirmDelete.type === 'user' ? 'utilisateur' : 'analyse'}`}.
                {confirmDelete.type === 'user' && " Note : Son historique ne sera pas supprimé automatiquement."}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all">Annuler</button>
                <button onClick={executeDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all">Supprimer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
