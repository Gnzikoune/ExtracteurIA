import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, increment } from 'firebase/firestore';

export type AnalyticsEvent = 
  | 'page_view' 
  | 'extraction_started' 
  | 'extraction_completed' 
  | 'extraction_failed' 
  | 'analysis_started'
  | 'login' 
  | 'logout' 
  | 'consent_accepted';

interface EventParams {
  url?: string;
  path?: string;
  error?: string;
  userId?: string;
  isAnonymous?: boolean;
  persistentId?: string;
  businessType?: string;
  linksCount?: number;
  score?: number;
}

export const logEvent = async (event: AnalyticsEvent, params: EventParams = {}) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const eventData = {
      event,
      ...params,
      timestamp: serverTimestamp(),
      date: today,
      userAgent: navigator.userAgent,
    };

    // 1. Log detailed event to 'analytics_events' collection
    await addDoc(collection(db, 'analytics_events'), eventData);

    // 2. Update daily aggregates for quick dashboard viewing
    const statsRef = doc(db, 'analytics_stats', today);
    const updateData: any = {
      updatedAt: serverTimestamp()
    };

    if (event === 'page_view') updateData.pageViews = increment(1);
    if (event === 'extraction_completed') updateData.extractions = increment(1);
    if (event === 'extraction_failed') updateData.errors = increment(1);
    if (event === 'consent_accepted') updateData.consents = increment(1);

    await setDoc(statsRef, updateData, { merge: true });

  } catch (error) {
    console.error('Failed to log analytics event:', error);
  }
};
