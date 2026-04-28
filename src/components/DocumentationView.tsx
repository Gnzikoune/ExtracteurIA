import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Search, Sparkles, History, ShieldAlert, Download, BrainCircuit, Lock, ExternalLink } from 'lucide-react';

export function DocumentationView({ 
  maxUserExtractions, 
  maxAnonExtractions 
}: { 
  maxUserExtractions: number, 
  maxAnonExtractions: number 
}) {
  const sections = [
    {
      id: 'extraction',
      title: 'Extraction de liens',
      icon: <Search className="w-6 h-6 text-indigo-500" />,
      color: 'from-indigo-500 to-indigo-600',
      bgLight: 'bg-indigo-50',
      content: (
        <div className="space-y-4 text-slate-600">
          <p>
            Le cœur d'ExtracteurIA est son moteur d'exploration de liens. Saisissez n'importe quelle URL publique et le robot naviguera sur la page pour extraire tous les liens cliquables (ancres HTML).
          </p>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mt-2">
            <h4 className="font-bold text-slate-900 mb-2">Deux modes d'exploration :</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <div className="bg-white border border-slate-200 shadow-sm p-1 rounded-md mt-0.5">
                  <span className="block w-2 h-2 bg-indigo-500 rounded-full"></span>
                </div>
                <div>
                  <strong className="text-slate-800">Scan Simple (Par défaut)</strong>
                  <p className="text-sm">Scanne uniquement la page exacte que vous avez renseignée. Rapide, c'est idéal pour auditer des pages d'atterrissage uniques (Landing pages).</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="bg-white border border-slate-200 shadow-sm p-1 rounded-md mt-0.5">
                  <span className="block w-2 h-2 bg-purple-500 rounded-full"></span>
                </div>
                <div>
                  <strong className="text-slate-800">Exploration approfondie (Deep Scan)</strong>
                  <p className="text-sm">Le robot parcourt non seulement la page d'accueil, mais s'aventure aussi sur les pages internes jusqu'à un total de 15 pages. Réservé aux utilisateurs connectés pour éviter les surcharges.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'ai-diagnosis',
      title: 'Diagnostic Intelligence Artificielle',
      icon: <BrainCircuit className="w-6 h-6 text-purple-500" />,
      color: 'from-purple-500 to-purple-600',
      bgLight: 'bg-purple-50',
      content: (
        <div className="space-y-4 text-slate-600">
          <p>
            Une fois l'extraction terminée, vous pouvez soumettre les données à notre intelligence artificielle propulsée par <strong>Gemini 3 Flash</strong>.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm mt-2">
            <li><strong>Score Global :</strong> Une note sur 100 évaluant le potentiel de conversion de votre site web, basé sur sa structure et son maillage de liens.</li>
            <li><strong>Catégorisation :</strong> Les liens extraits sont classés automatiquement (Navigation, Réseaux sociaux, Articles, etc.) pour vous donner une vue structurée.</li>
            <li><strong>Problèmes détectés :</strong> L'IA identifie les points bloquants ou absents (pas de page contact, pas de système d'achat/réservation, maillage faible).</li>
            <li><strong>Opportunités :</strong> Des recommandations concrètes et activables pour améliorer le site de manière décisive.</li>
          </ul>
          <div className="bg-amber-50 border border-amber-100 text-amber-800 p-3 rounded-lg text-sm flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Cette fonctionnalité consomme des quotas et est par conséquent réservée aux utilisateurs ayant créé un compte gratuit.</p>
          </div>
        </div>
      )
    },
    {
      id: 'history-export',
      title: 'Historique et Exportation',
      icon: <History className="w-6 h-6 text-emerald-500" />,
      color: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-50',
      content: (
        <div className="space-y-4 text-slate-600">
          <p>
            Toutes vos analyses (liens extraits et scores IA) sont sauvegardées de manière sécurisée dans le Cloud.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="border border-slate-200 rounded-xl p-4 bg-white/50">
              <History className="w-5 h-5 text-slate-400 mb-2" />
              <h4 className="font-bold text-slate-900 text-sm">Vue Historique</h4>
              <p className="text-sm mt-1">Retrouvez vos précédentes extractions à tout moment. Vous pouvez consulter les rapports IA, et même scorer d'anciens sites web sans les re-scanner.</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 bg-white/50">
              <Download className="w-5 h-5 text-slate-400 mb-2" />
              <h4 className="font-bold text-slate-900 text-sm">Export de données</h4>
              <p className="text-sm mt-1">Exportez les liens détectés et leurs catégories IA sous format JSON ou au format Excel (CSV) pour intégrer ces données dans vos propres outils.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'accounts',
      title: 'Comptes et Limitations',
      icon: <Lock className="w-6 h-6 text-slate-700" />,
      color: 'from-slate-600 to-slate-800',
      bgLight: 'bg-slate-100',
      content: (
        <div className="space-y-4 text-slate-600">
          <p>L'utilisation d'ExtracteurIA est régie par un système de quotas pour assurer la stabilité du service :</p>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl p-5">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
                Utilisateur Anonyme
              </h4>
              <ul className="text-sm space-y-1.5 text-slate-500">
                <li className="flex items-center gap-1.5">✅ Extraction simple de liens</li>
                <li className="flex items-center gap-1.5">❌ Analyse IA (Gemini)</li>
                <li className="flex items-center gap-1.5">❌ Historique persistant</li>
                <li className="flex items-center gap-1.5">❌ Export JSON/CSV</li>
                <li className="mt-2 text-xs font-bold text-slate-800 border-t border-slate-100 pt-2">Limite : {maxAnonExtractions} analyses</li>
              </ul>
            </div>
            
            <div className="flex-1 bg-indigo-50 border border-indigo-100 shadow-md shadow-indigo-100 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <Sparkles className="w-20 h-20 text-indigo-500" />
              </div>
              <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-2 relative z-10">
                Utilisateur Connecté
              </h4>
              <ul className="text-sm space-y-1.5 text-indigo-700/80 relative z-10">
                <li className="flex items-center gap-1.5"><strong className="text-indigo-900">✅ Tout débloqué</strong></li>
                <li className="flex items-center gap-1.5">✅ Extraction Deep Scan (15 pages)</li>
                <li className="flex items-center gap-1.5">✅ Diagnostiques IA complets</li>
                <li className="flex items-center gap-1.5">✅ Sauvegarde Historique</li>
                <li className="mt-2 text-xs font-bold text-indigo-900 border-t border-indigo-200/50 pt-2">Limite : {maxUserExtractions} analyses</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 text-white p-10 md:p-14 shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/20 blur-[80px] rounded-full -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/20 blur-[80px] rounded-full -ml-20 -mb-20 pointer-events-none"></div>
        
        <div className="relative z-10 text-center space-y-4">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <BookOpen className="w-8 h-8 text-indigo-300" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Documentation technique</h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Découvrez toutes les capacités d'ExtracteurIA. Apprenez à exploiter notre moteur d'exploration et notre intelligence artificielle pour auditer vos sites web.
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="space-y-6">
        {sections.map((section, index) => (
          <motion.div 
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-slate-200/60 p-6 md:p-10 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-30 blur-3xl -mr-10 -mt-10 rounded-full ${section.bgLight} transition-transform duration-700 group-hover:scale-150`}></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${section.bgLight} border border-white`}>
                  {section.icon}
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{section.title}</h2>
              </div>
              
              {section.content}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer support */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center mt-12 mb-8">
        <h3 className="font-bold text-slate-900 mb-2">Besoin de plus d'informations ?</h3>
        <p className="text-slate-500 text-sm mb-4">Si vous rencontrez un problème technique ou avez besoin d'une fonctionnalité sur mesure.</p>
        <a 
          href="mailto:gnzikoune@gmail.com" 
          className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-6 py-2.5 rounded-xl transition-colors"
        >
          Contacter l'administrateur
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

    </div>
  );
}
