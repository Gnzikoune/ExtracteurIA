import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Settings, Users, Database, Save, CheckCircle2, History, Sparkles, Eye, EyeOff } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

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
  onScore
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
  onScore: (item: any) => void
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [emailApiKey, setEmailApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showEmailKey, setShowEmailKey] = useState(false);

  // Synchronize local state with props when they are loaded from Firestore
  React.useEffect(() => {
    if (geminiApiKey) setApiKey(geminiApiKey);
    if (emailVerifyApiKey) setEmailApiKey(emailVerifyApiKey);
  }, [geminiApiKey, emailVerifyApiKey]);

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
        <p>Chargement des données d'administration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
          <Settings className="w-5 h-5" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Administration</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Settings Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
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
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  {geminiApiKey ? (
                    <span className="text-emerald-600 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Configuré
                    </span>
                  ) : (
                    "Si définie, cette clé sera utilisée à la place de la clé d'environnement."
                  )}
                </p>
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
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  {emailVerifyApiKey ? (
                    <span className="text-emerald-600 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Configuré
                    </span>
                  ) : (
                    "Utilisée pour vérifier la validité des adresses email à l'inscription."
                  )}
                </p>
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
          className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col gap-6"
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

      {/* Users List */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            Liste des utilisateurs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Rôle</th>
                <th className="px-6 py-4">Extractions</th>
                <th className="px-6 py-4">Dernière connexion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersWithEmail.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                      {u.role || 'user'}
                    </span>
                  </td>
                  <td className="px-6 py-4">{u.extractionCount || 0}</td>
                  <td className="px-6 py-4">
                    {u.lastActive ? new Date(u.lastActive.toDate ? u.lastActive.toDate() : u.lastActive).toLocaleDateString('fr-FR') : 'N/A'}
                  </td>
                </tr>
              ))}
              {usersWithEmail.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Aucun utilisateur trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
      {/* History List */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            Historique complet des analyses
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">URL</th>
                <th className="px-6 py-4">Utilisateur</th>
                <th className="px-6 py-4">Score</th>
                <th className="px-6 py-4">Type d'entreprise</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allHistory.map(h => (
                <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 max-w-[200px] truncate" title={h.url}>{h.url}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${h.isAnonymous ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {h.isAnonymous ? 'Anonyme' : (h.userId || 'Connecté')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {h.ai?.scoreGlobal !== undefined ? (
                      <span className={`font-bold ${h.ai.scoreGlobal >= 70 ? 'text-emerald-600' : h.ai.scoreGlobal >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                        {h.ai.scoreGlobal}
                      </span>
                    ) : (
                      <button 
                        onClick={() => onScore(h)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Scorer
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">{h.ai?.businessType || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {h.createdAt ? new Date(h.createdAt.toDate ? h.createdAt.toDate() : h.createdAt).toLocaleString('fr-FR') : 'N/A'}
                  </td>
                </tr>
              ))}
              {allHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Aucun historique trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
