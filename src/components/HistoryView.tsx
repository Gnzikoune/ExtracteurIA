import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ExternalLink, Calendar, Link as LinkIcon, Sparkles, Trash2, CheckSquare, Square, AlertCircle } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
        <p>Chargement de l'historique...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Aucun historique</h3>
        <p className="text-sm text-slate-500">Vous n'avez pas encore effectué d'analyse.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          Historique de vos analyses
          <span className="text-sm font-normal text-slate-500">({history.length})</span>
        </h2>
        
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setShowConfirm(selectedIds)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold border border-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer ({selectedIds.length})
            </motion.button>
          )}
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
          >
            {selectedIds.length === history.length ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
            Tout sélectionner
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {history.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center relative group ${
              selectedIds.includes(item.id) ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start gap-4">
              <button 
                onClick={() => toggleSelect(item.id)}
                className={`mt-1 transition-colors ${selectedIds.includes(item.id) ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'}`}
              >
                {selectedIds.includes(item.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
              </button>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-indigo-500" />
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1 max-w-[200px] sm:max-w-xs truncate">
                    {new URL(item.url).hostname}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  {new Date(item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt).toLocaleDateString('fr-FR', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Score</p>
                  {item.ai?.scoreGlobal !== undefined ? (
                    <p className={`text-lg font-black ${
                      (item.ai?.scoreGlobal || 0) >= 80 ? 'text-emerald-500' :
                      (item.ai?.scoreGlobal || 0) >= 50 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {item.ai.scoreGlobal}/100
                    </p>
                  ) : (
                    <button
                      onClick={() => onScore(item)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold border border-indigo-100 transition-all"
                    >
                      <Sparkles className="w-3 h-3" />
                      Scorer
                    </button>
                  )}
                </div>
                <div className="hidden sm:block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                  {item.ai?.businessType || 'N/A'}
                </div>
              </div>

              <button
                onClick={() => setShowConfirm([item.id])}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Supprimer cette analyse"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
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
                Cette action est irréversible. {showConfirm.length > 1 ? `Ces ${showConfirm.length} éléments seront définitivement supprimés.` : "Cet élément sera définitivement supprimé."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDelete(showConfirm)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
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
