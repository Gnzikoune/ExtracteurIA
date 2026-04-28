import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ExternalLink, Calendar, Link as LinkIcon, Sparkles, Trash2, CheckSquare, Square, AlertCircle, Clock, Globe, BarChart2, ChevronRight, Activity } from 'lucide-react';

export function HistoryView({ 
  history, 
  isLoading,
  onScore,
  onDelete
}: { 
  history: any[], 
  isLoading: boolean,
  onScore: (item: any) => void,
  onDelete: (ids: string[]) => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState<string[] | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === history.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(history.map(item => item.id));
    }
  };

  const handleDelete = (ids: string[]) => {
    onDelete(ids);
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    setShowConfirm(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-500">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 relative z-10" />
        </div>
        <p className="mt-4 font-medium text-slate-600 animate-pulse">Chargement de votre historique...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-slate-200/60 p-12 text-center shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100/50 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-100/50 rounded-full blur-3xl -ml-20 -mb-20"></div>
        
        <div className="relative z-10">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-white">
            <Activity className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Aucun historique d'analyse</h3>
          <p className="text-base text-slate-500 max-w-md mx-auto">Vous n'avez pas encore diagnostiqué de site web. Retournez au tableau de bord pour lancer votre première analyse approfondie.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-slate-200/50 shadow-sm">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl text-white shadow-md shadow-indigo-200">
              <BarChart2 className="w-5 h-5" />
            </div>
            Historique des analyses
            <span className="text-sm font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">
              {history.length}
            </span>
          </h2>
          <p className="text-sm text-slate-500 mt-2 ml-12">Retrouvez et gérez vos anciens diagnostics IA.</p>
        </div>
        
        <div className="flex items-center gap-2 md:ml-0 ml-12">
          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                onClick={() => setShowConfirm(selectedIds)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-sm font-bold border border-red-100 transition-all shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer ({selectedIds.length})
              </motion.button>
            )}
          </AnimatePresence>
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            {selectedIds.length === history.length ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
            <span className="hidden sm:inline">Tout sélectionner</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {history.map((item, index) => {
          const isSelected = selectedIds.includes(item.id);
          const hasScore = item.ai?.scoreGlobal !== undefined;
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`group relative flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-5 rounded-2xl border transition-all duration-300 ${
                isSelected 
                  ? 'border-indigo-400 bg-indigo-50/50 shadow-md shadow-indigo-100' 
                  : 'bg-white/80 backdrop-blur-xl border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 hover:border-indigo-200'
              }`}
            >
              {/* Subtle background glow on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-500 pointer-events-none"></div>

              <div className="flex items-start gap-4 relative z-10 w-full md:w-auto">
                <button 
                  onClick={() => toggleSelect(item.id)}
                  className={`mt-1.5 transition-colors ${isSelected ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'}`}
                >
                  {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>
                
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${hasScore ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Globe className="w-4 h-4" />
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1.5 text-base sm:text-lg truncate max-w-[200px] sm:max-w-sm md:max-w-md">
                      {new URL(item.url).hostname}
                      <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md w-fit font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt).toLocaleDateString('fr-FR', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    {item.ai?.businessType && (
                      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {item.ai.businessType}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between w-full md:w-auto gap-6 relative z-10 ml-9 md:ml-0 border-t border-slate-100 pt-4 md:border-t-0 md:pt-0">
                
                {/* Score Section */}
                <div className="flex items-center gap-4">
                  {hasScore ? (
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-widest mb-0.5">Score</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-black leading-none ${
                            (item.ai?.scoreGlobal || 0) >= 80 ? 'text-emerald-500' :
                            (item.ai?.scoreGlobal || 0) >= 50 ? 'text-amber-500' : 'text-red-500'
                          }`}>
                            {item.ai.scoreGlobal}
                          </span>
                          <span className="text-xs font-bold text-slate-300">/100</span>
                        </div>
                      </div>
                      
                      <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>
                      
                      <button
                        onClick={() => onScore(item)}
                        className="group/btn flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-indigo-600 text-slate-700 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-200 hover:border-indigo-600 shadow-sm"
                      >
                        Voir rapport
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-white transition-colors" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end">
                       <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-widest mb-1">Non évalué</span>
                       <button
                        onClick={() => onScore(item)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                      >
                        <Sparkles className="w-4 h-4" />
                        Diagnostiquer
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowConfirm([item.id])}
                  className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                  title="Supprimer cette analyse"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white p-8 max-w-sm w-full text-center overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5 relative z-10 border border-red-100 shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2 relative z-10">Confirmer la suppression</h3>
              <p className="text-slate-500 mb-8 text-sm relative z-10">
                Cette action est irréversible. {showConfirm.length > 1 ? `Ces ${showConfirm.length} éléments seront définitivement supprimés.` : "Cet élément sera définitivement supprimé de votre historique."}
              </p>
              <div className="flex gap-3 relative z-10">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDelete(showConfirm)}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all shadow-md shadow-red-500/20"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
