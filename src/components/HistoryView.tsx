import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, ExternalLink, Calendar, Link as LinkIcon, Sparkles } from 'lucide-react';

export function HistoryView({ 
  history, 
  isLoading,
  onScore
}: { 
  history: any[], 
  isLoading: boolean,
  onScore: (item: any) => void
}) {
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
      <h2 className="text-xl font-bold text-slate-900">Historique de vos analyses</h2>
      <div className="grid gap-3">
        {history.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-indigo-500" />
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1">
                  {new URL(item.url).hostname}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                {new Date(item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt).toLocaleDateString('fr-FR', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Score</p>
                {item.ai?.scoreGlobal !== undefined ? (
                  <p className={`text-lg font-bold ${
                    (item.ai?.scoreGlobal || 0) >= 80 ? 'text-emerald-500' :
                    (item.ai?.scoreGlobal || 0) >= 50 ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {item.ai.scoreGlobal}/100
                  </p>
                ) : (
                  <button
                    onClick={() => onScore(item)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-bold border border-indigo-100 transition-all hover:scale-105"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Analyser
                  </button>
                )}
              </div>
              <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium border border-slate-200">
                {item.ai?.businessType || 'N/A'}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
