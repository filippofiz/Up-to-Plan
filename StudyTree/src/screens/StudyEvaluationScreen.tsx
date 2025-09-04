import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// import * as ImageManipulator from 'expo-image-manipulator'; // Will install later
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

interface StudyEvaluationProps {
  route: {
    params: {
      slot: any;
      actualDuration: number;
      onComplete: (evaluation: any) => void;
    };
  };
  navigation: any;
}

interface QuestionToSave {
  tipologia_scuola: string;
  classe: string;
  materia: string;
  macroargomento: string;
  microargomento: string;
  domanda: string;
  tipo_domanda: 'multiple' | 'true_false' | 'open';
  difficolta: string;
  opzioni?: string[];
  risposta_corretta?: string;
  spiegazioni?: any;
  punti_chiave?: string[];
  risposta_modello?: string;
  criteri_valutazione?: any;
  created_by: string;
}

// API key should be stored in environment variables for security
// For production, use: process.env.CLAUDE_API_KEY
const CLAUDE_API_KEY = '';

// Helper function to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper function to compress image (placeholder - will use expo-image-manipulator later)
const compressImageToTarget = async (originalBlob: Blob, targetSize: number): Promise<Blob> => {
  // Temporary: Just return original blob since ImageManipulator is not installed
  console.log('COMPRESSION_PLACEHOLDER: ImageManipulator not available, using original image');
  console.log('ORIGINAL_SIZE:', Math.round(originalBlob.size / 1024), 'KB');
  console.log('TARGET_SIZE:', Math.round(targetSize / 1024), 'KB');
  return originalBlob;
};

// Helper function per status di comprensione
const getComprehensionStatus = (level: number) => {
  if (level >= 90) return '🏆 Eccellente - Sei preparato!';
  if (level >= 70) return '✅ Buona preparazione';
  if (level >= 50) return '📚 Preparazione sufficiente';
  if (level >= 30) return '⚠️ Serve più studio';
  if (level >= 10) return '📖 Inizia a studiare';
  return '🔍 Valutazione in corso...';
};

// Funzioni per gestire domande generate
const searchExistingQuestions = async (
  tipologiaScuola: string,
  classe: string,
  materia: string,
  macroargomento: string,
  microargomento: string
) => {
  try {
    const { data, error } = await supabase
      .from('generated_questions')
      .select('*')
      .eq('tipologia_scuola', tipologiaScuola)
      .eq('classe', classe)
      .eq('materia', materia)
      .eq('macroargomento', macroargomento)
      .eq('microargomento', microargomento)
      .order('avg_success_rate', { ascending: false })
      .limit(5); // Prendiamo le 5 domande migliori

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error searching existing questions:', error);
    return [];
  }
};

const saveGeneratedQuestions = async (
  questions: any,
  userProfile: any,
  macroargomenti: string[],
  microargomenti: string[],
  subjectName?: string
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const questionsToSave: QuestionToSave[] = [];

    // Domande multiple choice
    if (questions.domande_multiple) {
      questions.domande_multiple.forEach((q: any, index: number) => {
        questionsToSave.push({
          tipologia_scuola: userProfile?.tipologia_scuola || 'superiori',
          classe: userProfile?.classe || '3A',
          materia: subjectName || userProfile?.materia || 'matematica',
          macroargomento: macroargomenti[index] || macroargomenti[0] || 'argomento generale',
          microargomento: microargomenti[index] || microargomenti[0] || 'sottoargomento',
          domanda: q.domanda,
          tipo_domanda: 'multiple',
          difficolta: q.difficolta,
          opzioni: q.opzioni,
          risposta_corretta: q.risposta_corretta,
          spiegazioni: {
            spiegazione_corretta: q.spiegazione_corretta,
            spiegazione_sbagliate: q.spiegazione_sbagliate
          },
          criteri_valutazione: q.criteri_valutazione || {
            comprensione: 'Verifica la comprensione del concetto',
            applicazione: 'Capacità di applicare il concetto',
            analisi: 'Capacità di analizzare le opzioni'
          },
          created_by: user.id
        });
      });
    }

    // Domande vero/falso
    if (questions.domande_vero_falso) {
      questions.domande_vero_falso.forEach((q: any, index: number) => {
        questionsToSave.push({
          tipologia_scuola: userProfile?.tipologia_scuola || 'superiori',
          classe: userProfile?.classe || '3A',
          materia: subjectName || userProfile?.materia || 'matematica',
          macroargomento: macroargomenti[index] || macroargomenti[0] || 'argomento generale',
          microargomento: microargomenti[index] || microargomenti[0] || 'sottoargomento',
          domanda: q.domanda,
          tipo_domanda: 'true_false',
          difficolta: q.difficolta,
          opzioni: q.opzioni,
          risposta_corretta: q.risposta_corretta,
          spiegazioni: {
            spiegazione_vero: q.spiegazione_vero,
            spiegazione_falso: q.spiegazione_falso
          },
          criteri_valutazione: q.criteri_valutazione || {
            verifica_concetto: 'Verifica la comprensione del concetto',
            identificazione: 'Capacità di identificare vero/falso',
            ragionamento: 'Capacità di ragionamento logico'
          },
          created_by: user.id
        });
      });
    }

    // Domande aperte
    if (questions.domande_aperte) {
      questions.domande_aperte.forEach((q: any, index: number) => {
        questionsToSave.push({
          tipologia_scuola: userProfile?.tipologia_scuola || 'superiori',
          classe: userProfile?.classe || '3A',
          materia: subjectName || userProfile?.materia || 'matematica',
          macroargomento: macroargomenti[index] || macroargomenti[0] || 'argomento generale',
          microargomento: microargomenti[index] || microargomenti[0] || 'sottoargomento',
          domanda: q.domanda,
          tipo_domanda: 'open',
          difficolta: q.difficolta,
          punti_chiave: q.punti_chiave,
          risposta_modello: q.risposta_modello,
          spiegazioni: {
            spiegazione_completa: q.spiegazione_completa
          },
          criteri_valutazione: q.criteri_valutazione,
          created_by: user.id
        });
      });
    }

    // Salva nel database (usando upsert per evitare duplicati)
    const { data, error } = await supabase
      .from('generated_questions')
      .upsert(questionsToSave, { 
        onConflict: 'tipologia_scuola,classe,materia,macroargomento,microargomento,domanda',
        ignoreDuplicates: true 
      });

    if (error) throw error;
    
    console.log('✅ Saved questions to database:', questionsToSave.length);
    return data;
  } catch (error) {
    console.error('❌ Error saving questions:', error);
  }
};

const updateQuestionUsage = async (questionIds: number[]) => {
  try {
    // Aggiorna il contatore di utilizzo per le domande usate
    const { error } = await supabase.rpc('increment_question_usage', {
      question_ids: questionIds
    });

    if (error) {
      console.error('❌ Error updating question usage:', error);
    } else {
      console.log('✅ Updated usage stats for', questionIds.length, 'questions');
    }
  } catch (error) {
    console.error('❌ Error updating question usage:', error);
  }
};

const updateQuestionSuccessRate = async (questionId: number, isCorrect: boolean) => {
  try {
    const { error } = await supabase.rpc('update_question_success_rate', {
      question_id: questionId,
      is_correct: isCorrect
    });

    if (error) {
      console.error('❌ Error updating question success rate:', error);
    } else {
      console.log(`✅ Updated success rate for question ${questionId}: ${isCorrect ? 'correct' : 'incorrect'}`);
    }
  } catch (error) {
    console.error('❌ Error updating question success rate:', error);
  }
};

const convertExistingQuestionsToEvaluation = (questions: any[]) => {
  const domande_multiple: any[] = [];
  const domande_vero_falso: any[] = [];
  const domande_aperte: any[] = [];
  
  questions.forEach((q) => {
    const baseQuestion = {
      id: q.id, // Mantieni l'ID per tracciare statistiche
      domanda: q.domanda,
      difficolta: q.difficolta,
      spiegazione_corretta: q.spiegazioni?.spiegazione_corretta,
      spiegazione_completa: q.spiegazioni?.spiegazione_completa
    };
    
    if (q.tipo_domanda === 'multiple') {
      domande_multiple.push({
        ...baseQuestion,
        opzioni: q.opzioni,
        risposta_corretta: q.risposta_corretta,
        spiegazione_sbagliate: q.spiegazioni?.spiegazione_sbagliate
      });
    } else if (q.tipo_domanda === 'true_false') {
      domande_vero_falso.push({
        ...baseQuestion,
        opzioni: q.opzioni,
        risposta_corretta: q.risposta_corretta,
        spiegazione_vero: q.spiegazioni?.spiegazione_vero,
        spiegazione_falso: q.spiegazioni?.spiegazione_falso
      });
    } else if (q.tipo_domanda === 'open') {
      domande_aperte.push({
        ...baseQuestion,
        punti_chiave: q.punti_chiave,
        risposta_modello: q.risposta_modello,
        criteri_valutazione: q.criteri_valutazione
      });
    }
  });
  
  return {
    argomenti_studiati: [...new Set(questions.map(q => q.macroargomento))],
    livello_materiale: questions[0]?.difficolta || 'intermedio',
    domande_multiple,
    domande_vero_falso,
    domande_aperte,
    valutazione_finale: {
      livello_preparazione: 'buona_preparazione',
      percentuale_corrette: 0,
      tempo_studio_raccomandato: '60min',
      prossimi_passi: [
        '1. OGGI: Completa il quiz di valutazione (15min)',
        '2. DOMANI: Ripassa argomenti con errori (30min)',
        '3. QUESTA SETTIMANA: Pratica con esercizi aggiuntivi (2 ore)',
        '4. PROSSIMA VERIFICA: Test completo simulato (45min)'
      ],
      piano_studio_modifiche: {
        aumentare_tempo: 'No',
        ridurre_tempo: 'No',
        argomenti_prioritari: questions.map(q => q.microargomento),
        metodo_consigliato: 'Mix teoria-pratica'
      },
      punti_deboli: ['Completa il quiz per identificare aree di miglioramento'],
      punti_forti: ['Domande disponibili basate su valutazioni precedenti']
    },
    riepilogo: `Usando ${questions.length} domande precedentemente testate per questi argomenti.`
  };
};

export default function StudyEvaluationScreen({ route, navigation }: StudyEvaluationProps) {
  const { slot, actualDuration, onComplete } = route.params;
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'photos' | 'ai_evaluation' | 'quiz' | 'results'>('photos');
  const [userAnswers, setUserAnswers] = useState<any>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showCorrection, setShowCorrection] = useState<number | null>(null);
  const [comprehensionLevel, setComprehensionLevel] = useState(0); // 0-100%
  const [adaptiveQuestions, setAdaptiveQuestions] = useState<any[]>([]);
  const [isGeneratingNextQuestion, setIsGeneratingNextQuestion] = useState(false);
  const [hasEvaluatedCurrentAnswer, setHasEvaluatedCurrentAnswer] = useState(false);
  const [currentVote, setCurrentVote] = useState(0); // Voto da 1-10 invece di percentuale

  // Funzione intelligente per calcolare il voto considerando tutti i fattori
  const calculateIntelligentVote = (responses: any[]) => {
    let totalScore = 0;
    let totalWeight = 0;
    const errorTypes: string[] = [];
    const strengths: string[] = [];
    
    responses.forEach((response, index) => {
      const { isCorrect, difficulty, questionType, errorType, partialScore } = response;
      
      // Peso basato sulla difficoltà
      let weight = 1;
      if (difficulty === 'base') weight = 1;
      else if (difficulty === 'intermedio') weight = 1.5;
      else if (difficulty === 'avanzato') weight = 2;
      
      // Peso aggiuntivo per domande aperte
      if (questionType === 'open') weight *= 1.3;
      
      // Calcola punteggio per questa domanda
      let questionScore = 0;
      if (isCorrect) {
        questionScore = 10;
        if (difficulty === 'avanzato') strengths.push(`Eccellente su argomento avanzato (Q${index + 1})`);
        else if (difficulty === 'intermedio') strengths.push(`Buona comprensione (Q${index + 1})`);
      } else {
        // Punteggio parziale per domande aperte
        if (questionType === 'open' && partialScore) {
          questionScore = partialScore * 10;
        } else {
          questionScore = 0;
        }
        
        // Identifica tipo di errore
        if (errorType) errorTypes.push(errorType);
        else if (difficulty === 'base') errorTypes.push(`Lacuna nei fondamentali (Q${index + 1})`);
        else if (difficulty === 'intermedio') errorTypes.push(`Difficoltà applicative (Q${index + 1})`);
        else errorTypes.push(`Concetti avanzati non chiari (Q${index + 1})`);
      }
      
      totalScore += questionScore * weight;
      totalWeight += weight * 10; // Max score per domanda è 10
    });
    
    const finalVote = Math.round((totalScore / totalWeight) * 10);
    
    return {
      voto: Math.max(1, Math.min(10, finalVote)),
      errorTypes,
      strengths,
      diagnosis: generateDiagnosis(finalVote, errorTypes, responses)
    };
  };

  // Funzione per generare diagnosi e interventi
  const generateDiagnosis = (vote: number, errorTypes: string[], responses: any[]) => {
    let diagnosis = '';
    let interventions: string[] = [];
    
    if (vote >= 9) {
      diagnosis = '🏆 Eccellente preparazione - Padronanza completa';
      interventions.push('Mantieni questo livello con ripasso periodico');
      interventions.push('Potresti approfondire argomenti correlati');
    } else if (vote >= 7) {
      diagnosis = '✅ Buona preparazione - Alcune aree da consolidare';
      interventions.push('Ripassa gli argomenti dove hai avuto difficoltà');
      interventions.push('Fai più esercizi pratici');
    } else if (vote >= 6) {
      diagnosis = '📚 Preparazione sufficiente - Necessario maggiore studio';
      interventions.push('Studio più approfondito dei concetti base');
      interventions.push('Più tempo dedicato alla pratica');
    } else if (vote >= 4) {
      diagnosis = '⚠️ Preparazione insufficiente - Lacune importanti';
      interventions.push('Rivedere completamente gli argomenti fondamentali');
      interventions.push('Studiare con metodo più strutturato');
      interventions.push('Chiedere aiuto per i concetti non chiari');
    } else {
      diagnosis = '🚨 Preparazione inadeguata - Ripartire dalle basi';
      interventions.push('Studio completo del materiale dalle fondamenta');
      interventions.push('Supporto didattico aggiuntivo necessario');
      interventions.push('Piano di studio intensivo raccomandato');
    }
    
    return { diagnosis, interventions };
  };

  // Funzione per valutare la risposta corrente
  const evaluateCurrentAnswer = (currentQuestion: any) => {
    const userAnswer = userAnswers[currentQuestionIndex];
    let isCorrect = false;
    
    if (currentQuestion.type === 'multiple' || currentQuestion.type === 'true_false') {
      // Per domande multiple choice e vero/falso, confronto diretto
      isCorrect = currentQuestion.risposta_corretta === userAnswer;
      
      // Aggiorna comprensione e voto (usa una funzione semplice per ora)
      setComprehensionLevel(prev => {
        const change = isCorrect ? 15 : -5;
        return Math.max(0, Math.min(100, prev + change));
      });
      
      // Se la domanda ha un ID (proveniente da database), aggiorna statistiche
      if (currentQuestion.id) {
        updateQuestionSuccessRate(currentQuestion.id, isCorrect);
      }
      
      // Mostra correzione immediata
      setShowCorrection(currentQuestionIndex);
      
    } else if (currentQuestion.type === 'open') {
      // Per domande aperte, valutazione più complessa
      const score = evaluateOpenAnswer(currentQuestion, userAnswer);
      
      // Se la domanda ha un ID, aggiorna statistiche basate sul punteggio
      if (currentQuestion.id) {
        updateQuestionSuccessRate(currentQuestion.id, score > 0.6);
      }
    }
    
    setHasEvaluatedCurrentAnswer(true);
  };

  // Funzione per valutare domande aperte (semplificata per ora)
  const evaluateOpenAnswer = (question: any, userAnswer: string) => {
    // Valutazione semplificata basata su lunghezza e parole chiave
    const answerLength = userAnswer.trim().length;
    const hasKeywords = question.punti_chiave?.some((keyword: string) => 
      userAnswer.toLowerCase().includes(keyword.toLowerCase())
    ) || false;
    
    let score = 0;
    if (answerLength < 10) score = 0.2; // Risposta molto breve
    else if (answerLength < 50) score = hasKeywords ? 0.6 : 0.4; // Risposta breve
    else if (answerLength < 100) score = hasKeywords ? 0.8 : 0.6; // Risposta media
    else score = hasKeywords ? 1.0 : 0.7; // Risposta lunga
    
    // Aggiorna comprensione basata sul punteggio
    setComprehensionLevel(prev => {
      const change = score > 0.6 ? 12 : -3;
      return Math.max(0, Math.min(100, prev + change));
    });
    
    // Mostra sempre la spiegazione per domande aperte
    setShowCorrection(currentQuestionIndex);
    
    return score; // Restituisci il punteggio per aggiornare statistiche
  };

  // Funzione per generare domande aggiuntive basate sul livello attuale
  const generateAdditionalQuestions = async () => {
    if (isGeneratingNextQuestion) return; // Previeni richieste multiple
    
    setIsGeneratingNextQuestion(true);
    
    try {
      // Analizza le risposte dell'utente finora
      const answeredQuestions = Object.keys(userAnswers).map(index => {
        const allQuestions = [
          ...(evaluation.domande_multiple || []).map((q: any) => ({ ...q, type: 'multiple' })),
          ...(evaluation.domande_vero_falso || []).map((q: any) => ({ ...q, type: 'true_false' })),
          ...(evaluation.domande_aperte || []).map((q: any) => ({ ...q, type: 'open' }))
        ];
        const question = allQuestions[parseInt(index)];
        const userAnswer = userAnswers[index];
        const isCorrect = question?.risposta_corretta === userAnswer;
        
        return {
          domanda: question?.domanda,
          risposta_utente: userAnswer,
          risposta_corretta: question?.risposta_corretta,
          is_correct: isCorrect,
          difficolta: question?.difficolta,
          tipo: question?.type
        };
      });

      const adaptivePrompt = `
SISTEMA ADATTIVO: Genera NUOVE domande basate sulla performance dell'utente.

SITUAZIONE ATTUALE:
- Livello comprensione: ${comprehensionLevel}%
- Domande completate: ${Object.keys(userAnswers).length}
- Materia: ${slot.subject_name}

PERFORMANCE PASSATA:
${answeredQuestions.map((q, i) => 
  `${i+1}. ${q.domanda} → ${q.is_correct ? '✓' : '✗'} (${q.difficolta})`
).join('\n')}

OBIETTIVO: Raggiungi 100% comprensione con domande mirate

STRATEGIA INTELLIGENTE:
${comprehensionLevel < 30 ? '🔴 RINFORZO FONDAMENTA: Crea domande BASE sui concetti non compresi' : 
  comprehensionLevel < 60 ? '🟡 CONSOLIDAMENTO: Crea domande INTERMEDIE per solidificare' :
  comprehensionLevel < 90 ? '🟢 APPROFONDIMENTO: Crea domande AVANZATE per eccellenza' :
  '🏆 VERIFICA FINALE: Crea domande COMPLESSE per conferma'}

Genera ESATTAMENTE 5 nuove domande per continuare la valutazione.

RISPONDI SOLO CON QUESTO JSON:
{
  "nuove_domande_multiple": [
    {
      "domanda": "Domanda mirata basata sulla performance",
      "opzioni": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "risposta_corretta": "B",
      "difficolta": "base|intermedio|avanzato",
      "spiegazione_corretta": "Perché B è corretto...",
      "spiegazione_sbagliate": {
        "A": "Sbagliato perché...",
        "C": "Non corretto perché...", 
        "D": "Errato perché..."
      }
    }
  ],
  "nuove_domande_vero_falso": [...],
  "livello_raccomandato": "base|intermedio|avanzato"
}`;

      console.log('🔄 Generating adaptive questions...', { 
        currentLevel: comprehensionLevel, 
        questionsAnswered: Object.keys(userAnswers).length 
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: adaptivePrompt
          }]
        })
      });

      if (response.ok) {
        const result = await response.json();
        const responseText = result.content[0].text;
        
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const newQuestionsData = JSON.parse(jsonMatch[0]);
            
            // Aggiungi le nuove domande all'evaluation esistente
            const updatedEvaluation = {
              ...evaluation,
              domande_multiple: [
                ...(evaluation.domande_multiple || []),
                ...(newQuestionsData.nuove_domande_multiple || [])
              ],
              domande_vero_falso: [
                ...(evaluation.domande_vero_falso || []),
                ...(newQuestionsData.nuove_domande_vero_falso || [])
              ]
            };
            
            setEvaluation(updatedEvaluation);
            console.log('✅ Added adaptive questions:', {
              multiple: newQuestionsData.nuove_domande_multiple?.length || 0,
              truefalse: newQuestionsData.nuove_domande_vero_falso?.length || 0
            });
          }
        } catch (parseError) {
          console.error('❌ Failed to parse adaptive questions:', parseError);
        }
      }
    } catch (error) {
      console.error('❌ Error generating adaptive questions:', error);
    } finally {
      setIsGeneratingNextQuestion(false);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso Negato', 'Serve il permesso per la fotocamera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3, // Very low quality to fit under 500KB
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos([...photos, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert('Errore', 'Impossibile scattare la foto');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso Negato', 'Serve il permesso per la galleria');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3, // Very low quality to fit under 500KB  
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos([...photos, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert('Errore', 'Impossibile selezionare la foto');
    }
  };

  const uploadPhotosToSupabase = async () => {
    const uploadedUrls = [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ No user found for upload');
      return [];
    }

    console.log('📤 Starting upload process:', {
      user_id: user.id,
      photos_count: photos.length,
      bucket: 'study-photos'
    });

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        console.log(`📷 Processing photo ${i + 1}/${photos.length}:`, photo.substring(0, 100) + '...');
        
        const response = await fetch(photo);
        const blob = await response.blob();
        
        // Path must include user ID for RLS policy: {user_id}/filename
        const fileName = `${user.id}/study_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        
        console.log(`⬆️ Uploading to Supabase:`, {
          fileName,
          size_bytes: blob.size,
          type: blob.type
        });

        const { data, error } = await supabase.storage
          .from('study-photos')
          .upload(fileName, blob, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error('❌ Supabase upload error:', error);
          throw error;
        }

        console.log('✅ Upload successful:', data);

        const { data: { publicUrl } } = supabase.storage
          .from('study-photos')
          .getPublicUrl(fileName);

        console.log('🔗 Generated public URL:', publicUrl);
        uploadedUrls.push(publicUrl);
        
      } catch (error) {
        console.error('❌ Upload error for photo', i + 1, ':', error);
        Alert.alert('Errore Upload', `Impossibile caricare la foto ${i + 1}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
      }
    }

    console.log('📤 Upload process complete:', {
      successful_uploads: uploadedUrls.length,
      failed_uploads: photos.length - uploadedUrls.length,
      urls: uploadedUrls
    });

    return uploadedUrls;
  };

  const evaluateWithClaude = async () => {
    setLoading(true);
    setStep('ai_evaluation'); // Mostra immediatamente il loading
    
    try {
      // Ottieni profilo utente per cercare domande esistenti
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('❌ Error getting user:', authError);
      }
      
      let userProfile = null;
      
      if (user) {
        console.log('👤 User found:', user.id);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('tipologia_scuola, classe, materia')
          .eq('id', user.id)
          .single();
          
        if (profileError) {
          console.error('❌ Error fetching profile:', profileError);
          // Se il profilo non esiste, proviamo a crearlo
          if (profileError.code === 'PGRST116') { // No rows returned
            console.log('📝 Creating default profile for user...');
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                tipologia_scuola: 'superiori',
                classe: '3A',
                materia: slot.subject_name || 'materia'
              })
              .select()
              .single();
              
            if (createError) {
              console.error('❌ Error creating profile:', createError);
            } else {
              console.log('✅ Profile created:', newProfile);
              userProfile = newProfile;
            }
          }
        } else {
          console.log('✅ Profile found:', profile);
          userProfile = profile;
        }
      } else {
        console.log('⚠️ No user logged in');
      }

      // Upload foto su Supabase Storage
      const uploadedUrls = await uploadPhotosToSupabase();
      
      // Prima: Cerca se esistono già domande per questi argomenti
      let existingQuestions: any[] = [];
      
      console.log('🔍 Searching for existing questions...');
      
      if (userProfile) {
        // Fai una ricerca preliminare per capire macro/micro argomenti
        const preliminaryPrompt = `
Analizza velocemente queste foto di ${slot.subject_name} e identifica:
1. MACROARGOMENTO principale (es: "equazioni", "cinematica", "rivoluzione francese")
2. MICROARGOMENTO specifico (es: "equazioni secondo grado", "moto rettilineo uniforme", "cause rivoluzione")

Rispondi SOLO con JSON:
{
  "macroargomento": "argomento principale",
  "microargomento": "sottoargomento specifico"
}`;

        // Chiamata rapida per identificare argomenti
        const argomentiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 500,
            messages: [{
              role: 'user',
              content: preliminaryPrompt
            }]
          })
        });

        if (argomentiResponse.ok) {
          const result = await argomentiResponse.json();
          const responseText = result.content[0].text;
          
          try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const argomenti = JSON.parse(jsonMatch[0]);
              console.log('🎯 Identified topics:', argomenti);
              
              // Cerca domande esistenti
              existingQuestions = await searchExistingQuestions(
                userProfile.tipologia_scuola || 'superiori',
                userProfile.classe || '',
                userProfile.materia || slot.subject_name,
                argomenti.macroargomento,
                argomenti.microargomento
              );
              
              console.log(`💾 Found ${existingQuestions.length} existing questions`);
            }
          } catch (parseError) {
            console.warn('⚠️ Could not parse topics, continuing with new generation');
          }
        }
      }
      
      // Se abbiamo abbastanza domande esistenti, usale
      if (existingQuestions.length >= 5) {
        console.log('✅ Using existing questions from database');
        
        const selectedQuestions = existingQuestions.slice(0, 5);
        
        // Aggiorna statistiche di utilizzo
        const questionIds = selectedQuestions.map(q => q.id);
        await updateQuestionUsage(questionIds);
        
        // Converti domande esistenti nel formato evaluation
        const evaluation = convertExistingQuestionsToEvaluation(selectedQuestions);
        
        setEvaluation(evaluation);
        setStep('quiz');
        setCurrentQuestionIndex(0);
        return;
      }

      // Prepara il prompt per Claude
      const prompt = `
IMPORTANTE: SEI UN TUTOR ESPERTO che crea ESATTAMENTE 5 DOMANDE STRATEGICHE per valutare la preparazione.

Analizza ATTENTAMENTE ogni foto del libro/materiale per ${slot.subject_name}.

IL TUO COMPITO:
1. Leggi TUTTO il testo visibile: titoli, paragrafi, formule, definizioni, esempi
2. Identifica i 5 concetti PIÙ IMPORTANTI per valutare la preparazione
3. Crea ESATTAMENTE 5 domande strategiche (non di più, non di meno)
4. SCEGLI TU la tipologia più adatta per ogni domanda (multiple choice, vero/falso, o aperta) in base all'argomento

STRUTTURA DELLE 5 DOMANDE (difficoltà SEMPRE allineata al materiale fornito):
🔍 DOMANDA 1: Concetto fondamentale del materiale - per verificare comprensione base
🧠 DOMANDA 2: Applicazione pratica del contenuto - per verificare saper fare
🔗 DOMANDA 3: Collegamenti tra concetti - per verificare comprensione profonda
📊 DOMANDA 4: Analisi del materiale - per verificare padronanza
🎯 DOMANDA 5: Sintesi completa - per verificare eccellenza

IMPORTANTE: La difficoltà deve essere SEMPRE allineata al livello del materiale mostrato nelle foto, NON al tempo di studio.

OBIETTIVO: Con 5 domande mirate, determinare con precisione il livello di preparazione.

Materia: ${slot.subject_name} | Durata studio: ${actualDuration}min

REGOLA FONDAMENTALE: La somma di domande_multiple + domande_vero_falso + domande_aperte DEVE essere ESATTAMENTE 5.
Esempi validi: 3 multiple + 1 vero/falso + 1 aperta = 5, oppure 5 multiple + 0 vero/falso + 0 aperte = 5, ecc.

RISPONDI SOLO CON QUESTO FORMATO JSON ESATTO:
{
  "argomenti_studiati": ["argomento 1", "argomento 2", ...],
  "livello_materiale": "base|intermedio|avanzato",
  "macroargomenti": ["macro1", "macro2", "macro3", "macro4", "macro5"],
  "microargomenti": ["micro1", "micro2", "micro3", "micro4", "micro5"],
  "domande_multiple": [
    {
      "domanda": "Domanda breve e specifica?",
      "opzioni": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "risposta_corretta": "B",
      "difficolta": "base|intermedio|avanzato",
      "spiegazione_corretta": "Perché B è corretto: spiegazione dettagliata",
      "spiegazione_sbagliate": {
        "A": "Sbagliato perché...",
        "C": "Non corretto perché...", 
        "D": "Errato perché..."
      },
      "criteri_valutazione": {
        "comprensione": "Cosa verifica questa domanda",
        "competenza": "Quale competenza valuta",
        "obiettivo": "Obiettivo didattico"
      }
    }
  ],
  "domande_vero_falso": [
    {
      "domanda": "Affermazione da verificare",
      "opzioni": ["Vero", "Falso"],
      "risposta_corretta": "Vero", 
      "difficolta": "base|intermedio|avanzato",
      "spiegazione_vero": "È vero perché...",
      "spiegazione_falso": "Sarebbe falso se...",
      "criteri_valutazione": {
        "comprensione": "Cosa verifica questa domanda",
        "competenza": "Quale competenza valuta",
        "obiettivo": "Obiettivo didattico"
      }
    }
  ],
  "domande_aperte": [
    {
      "domanda": "Domanda aperta breve",
      "difficolta": "base|intermedio|avanzato",
      "punti_chiave": ["punto1", "punto2"],
      "risposta_modello": "Risposta completa modello",
      "spiegazione_completa": "Spiegazione dettagliata di cosa doveva includere la risposta e perché",
      "criteri_valutazione": ["Completezza", "Precisione tecnica", "Collegamenti", "Esempi pratici"],
      "feedback_livelli": {
        "eccellente": "Risposta che include tutti i punti chiave con esempi",
        "buona": "Risposta corretta ma mancano dettagli o esempi", 
        "superficiale": "Risposta generica senza approfondimenti",
        "insufficiente": "Risposta incompleta o con errori concettuali"
      }
    }
  ],
  "valutazione_finale": {
    "livello_preparazione": "conoscenza_superficiale|buona_preparazione|deve_studiare_ancora|eccellente",
    "percentuale_corrette": 0,
    "tempo_studio_raccomandato": "30min|60min|90min|120min",
    "prossimi_passi": [
      "1. OGGI: Ripassa formule X,Y,Z (15min)",
      "2. DOMANI: Fai 5 esercizi su argomento A (30min)", 
      "3. QUESTA SETTIMANA: Studia capitolo N (2 ore)",
      "4. PROSSIMA VERIFICA: Simula test completo (45min)"
    ],
    "piano_studio_modifiche": {
      "aumentare_tempo": "Si/No - se sì, da X a Y minuti",
      "ridurre_tempo": "Si/No - se sì, da X a Y minuti", 
      "argomenti_prioritari": ["arg1", "arg2"],
      "metodo_consigliato": "Più teoria|Più pratica|Mix teoria-pratica|Ripasso intensivo"
    },
    "punti_deboli": ["argomento1 - cosa fare", "argomento2 - come migliorare"],
    "punti_forti": ["argomento3 - mantieni livello", "argomento4 - puoi approfondire"]
  },
  "riepilogo": "Riassunto argomenti e livello del materiale"
}
`;

      // Prepara content con immagini per Claude
      const content = [
        {
          type: 'text',
          text: prompt
        }
      ];

      console.log('================== AI EVALUATION START ==================');
      console.log('PHOTOS_TAKEN:', photos.length);
      console.log('UPLOADED_URLS:', uploadedUrls.length);
      console.log('WILL_INCLUDE_IMAGES:', photos.length > 0);
      console.log('========================================================');

      // Aggiungi le immagini se ci sono (Claude format - base64)
      if (uploadedUrls.length > 0) {
        for (let i = 0; i < Math.min(photos.length, uploadedUrls.length); i++) {
          try {
            console.log('======= PROCESSING IMAGE', (i + 1), '=======');
            console.log('IMAGE_PATH:', photos[i].substring(0, 150));
            
            // Converti l'immagine locale in base64
            const response = await fetch(photos[i]);
            let blob = await response.blob();
            
            console.log('BLOB_SIZE_BYTES:', blob.size);
            console.log('BLOB_TYPE:', blob.type);
            console.log('BLOB_SIZE_MB:', Math.round(blob.size / 1024 / 1024 * 100) / 100);
            
            // Skip if blob is invalid
            if (blob.size === 0) {
              console.warn('⚠️  Skipping empty blob');
              continue;
            }
            
            // Check if image needs compression (target 500KB for Claude safety)
            const targetSize = 500 * 1024; // 500KB target (much safer than 5MB)
            const sizeKB = Math.round(blob.size / 1024);
            
            console.log('SIZE_CHECK_KB:', sizeKB);
            console.log('TARGET_SIZE_KB:', 500);
            console.log('NEEDS_COMPRESSION:', blob.size > targetSize);
            
            if (blob.size > targetSize) {
              console.log('COMPRESSING IMAGE FROM', sizeKB, 'KB TO ~500KB');
              
              try {
                // Auto-compress large images
                const compressedBlob = await compressImageToTarget(blob, targetSize);
                console.log('COMPRESSION SUCCESS');
                console.log('ORIGINAL_SIZE_KB:', sizeKB);
                console.log('COMPRESSED_SIZE_KB:', Math.round(compressedBlob.size / 1024));
                blob = compressedBlob;
              } catch (compressError) {
                console.log('COMPRESSION_FAILED:', compressError instanceof Error ? compressError.message : String(compressError));
                console.log('USING_ORIGINAL_IMAGE');
                // Continue with original if compression fails
              }
            } else {
              console.log('SIZE_OK_NO_COMPRESSION_NEEDED:', sizeKB, 'KB');
            }
            
            const base64 = await blobToBase64(blob);
            const base64Data = base64.split(',')[1]; // Rimuovi il prefisso
            
            // Detect proper media type
            let mediaType = 'image/jpeg';
            if (base64.startsWith('data:image/png')) {
              mediaType = 'image/png';
            } else if (base64.startsWith('data:image/webp')) {
              mediaType = 'image/webp';
            }
            
            console.log(`📝 Base64 conversion:`, {
              media_type: mediaType,
              original_prefix: base64.substring(0, 50),
              data_length: base64Data.length,
              data_preview: base64Data.substring(0, 50) + '...',
              is_valid_base64: /^[A-Za-z0-9+/=]+$/.test(base64Data.substring(0, 100))
            });
            
            // Validate base64 data
            if (!base64Data || base64Data.length < 100) {
              console.error('❌ INVALID BASE64 DATA:');
              console.error('  - Data length:', base64Data?.length || 0);
              console.error('  - Data sample:', base64Data?.substring(0, 100) || 'null');
              console.warn('⚠️  Skipping invalid base64 image');
              continue;
            }
            
            // Final validation check
            const isValidBase64 = /^[A-Za-z0-9+/=]+$/.test(base64Data);
            if (!isValidBase64) {
              console.error('❌ BASE64 FORMAT INVALID: Contains invalid characters');
              console.error('  - First 100 chars:', base64Data.substring(0, 100));
              console.warn('⚠️  Skipping malformed base64 image');
              continue;
            }
            
            console.log(`✅ Base64 validation passed: ${base64Data.length} chars`);
            
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data
              }
            } as any);
            
            console.log(`✅ Successfully added image ${i + 1} to Claude request`);
            
          } catch (error) {
            console.error(`❌ Error processing image ${i + 1}:`, error);
          }
        }
      }

      const requestBody = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000, // Increased from 1000 to prevent JSON truncation
        messages: [{
          role: 'user',
          content: content
        }]
      };

      const imageCount = content.filter(item => item.type === 'image').length;
      
      console.log('🤖 Claude API Request:', {
        url: 'https://api.anthropic.com/v1/messages',
        model: requestBody.model,
        max_tokens: requestBody.max_tokens,
        total_content_items: content.length,
        text_items: content.filter(item => item.type === 'text').length,
        image_items: imageCount,
        prompt_length: prompt.length
      });

      // Chiama Claude API
      const startTime = Date.now();
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      const responseTime = Date.now() - startTime;

      // Log response headers per vedere crediti e rate limits
      console.log('📊 Claude API Response Headers:', {
        status: response.status,
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
        'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
        'x-request-id': response.headers.get('x-request-id'),
        response_time_ms: responseTime
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Claude API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        // Debug dell'errore con dettagli completi
        console.error('🔍 CLAUDE ERROR ANALYSIS:');
        console.error('  Status:', response.status);
        console.error('  Error text:', errorText);
        console.error('  Content items sent:', content.length);
        console.error('  Images sent:', content.filter(c => c.type === 'image').length);
        
        // Log del contenuto inviato (senza base64 per non spammare)
        content.forEach((item, index) => {
          if (item.type === 'text') {
            console.error(`  Content[${index}]: TEXT (${(item as any).text.length} chars)`);
          } else if (item.type === 'image') {
            console.error(`  Content[${index}]: IMAGE (${(item as any).source.media_type}, ${(item as any).source.data.length} chars)`);
          }
        });
        
        // Errori specifici
        if (response.status === 401) {
          throw new Error('Errore API: Chiave API non valida o scaduta');
        } else if (response.status === 402) {
          throw new Error('Errore API: Credito insufficiente');
        } else if (response.status === 429) {
          throw new Error('Errore API: Troppi richieste, riprova tra poco');
        } else if (response.status === 400 && errorText.includes('base64')) {
          throw new Error(`Errore API: Formato immagine non supportato - ${errorText}`);
        } else {
          throw new Error(`Errore API Claude: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();
      
      console.log('✅ Claude API Response Success:', {
        input_tokens: result.usage?.input_tokens,
        output_tokens: result.usage?.output_tokens,
        response_length: result.content[0]?.text?.length,
        model_used: result.model
      });

      // Parse AI response
      let aiEvaluation;
      try {
        const responseText = result.content[0].text;
        console.log('📝 Raw Claude Response:', responseText.substring(0, 500) + '...');
        console.log('📝 Full Response Length:', responseText.length);
        
        // Estrai JSON dalla risposta usando multiple strategie
        let jsonString = '';
        
        // Strategia 1: Cerca JSON completo tra { e }
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
        } else {
          // Strategia 2: Cerca dopo la prima { fino alla fine
          const startIndex = responseText.indexOf('{');
          if (startIndex !== -1) {
            jsonString = responseText.substring(startIndex);
          } else {
            throw new Error('Nessun JSON trovato nella risposta');
          }
        }
        
        console.log('📝 Extracted JSON Length:', jsonString.length);
        console.log('📝 JSON Preview:', jsonString.substring(0, 200) + '...');
        
        // Verifica che il JSON sia completo (deve finire con })
        if (!jsonString.trim().endsWith('}')) {
          console.warn('⚠️ JSON sembra incompleto, tentativo di correzione...');
          // Prova a bilanciare le parentesi graffe
          const openBraces = (jsonString.match(/\{/g) || []).length;
          const closeBraces = (jsonString.match(/\}/g) || []).length;
          
          if (openBraces > closeBraces) {
            // Aggiungi le parentesi mancanti
            const missingBraces = openBraces - closeBraces;
            jsonString += '}'.repeat(missingBraces);
            console.log('🔧 JSON corretto aggiungendo', missingBraces, 'parentesi di chiusura');
          } else {
            throw new Error('JSON incompleto - impossibile correggere automaticamente');
          }
        }
        
        // Prova il parsing
        aiEvaluation = JSON.parse(jsonString);
        console.log('✅ Parsed AI Evaluation:', aiEvaluation);
        
        // Verifica che abbia almeno i campi essenziali
        if (!aiEvaluation.valutazione_finale && !aiEvaluation.domande_multiple && !aiEvaluation.domande_vero_falso) {
          console.warn('⚠️ JSON valido ma struttura incompleta');
          throw new Error('Struttura JSON incompleta');
        }
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        console.error('❌ Error details:', parseError instanceof Error ? parseError.message : String(parseError));
        // Fallback: crea quiz di default
        aiEvaluation = {
          argomenti_studiati: ["Contenuto delle foto analizzato manualmente"],
          livello_materiale: "intermedio",
          domande_multiple: [
            {
              domanda: "Basandoti sul materiale delle foto, quale concetto principale è stato trattato?",
              opzioni: ["A) Concetto teorico di base", "B) Applicazione pratica", "C) Esempi numerici", "D) Definizioni specifiche"],
              risposta_corretta: "A",
              difficolta: "base",
              spiegazione: "Quiz di fallback - analisi manuale necessaria"
            }
          ],
          domande_vero_falso: [
            {
              domanda: "Il materiale studiato contiene informazioni teoriche importanti",
              opzioni: ["Vero", "Falso"],
              risposta_corretta: "Vero",
              difficolta: "base",
              spiegazione: "Domanda generica di backup"
            }
          ],
          domande_aperte: [
            {
              domanda: "Analizza il contenuto principale dalle foto",
              difficolta: "intermedio", 
              punti_chiave: ["Concetti principali", "Definizioni importanti"],
              risposta_modello: "Fornisci spiegazione basata sul contenuto delle foto"
            }
          ],
          valutazione_finale: {
            livello_preparazione: "conoscenza_superficiale",
            percentuale_corrette: 0,
            tempo_studio_raccomandato: "60min",
            prossimi_passi: [
              "1. OGGI: Ripassa il materiale fotografato (30min)",
              "2. DOMANI: Fai un test di verifica autonomo (20min)",
              "3. QUESTA SETTIMANA: Approfondisci concetti base (90min)",
              "4. PROSSIMA VERIFICA: Ripeti questo processo (quiz AI)"
            ],
            piano_studio_modifiche: {
              aumentare_tempo: "No",
              ridurre_tempo: "No",
              argomenti_prioritari: ["Tutti gli argomenti dalle foto"],
              metodo_consigliato: "Mix teoria-pratica"
            },
            punti_deboli: ["Valutazione automatica non disponibile - completa quiz"],
            punti_forti: ["Sessione di studio completata"]
          },
          riepilogo: "AI non disponibile - quiz di backup generato automaticamente."
        };
        console.log('🔄 Using fallback evaluation:', aiEvaluation);
      }
      
      setEvaluation(aiEvaluation);
      setStep('quiz'); // Passa direttamente al quiz interattivo
      setCurrentQuestionIndex(0); // Inizia dalla prima domanda
      
      // Salva le nuove domande generate nel database
      if (aiEvaluation.macroargomenti && aiEvaluation.microargomenti) {
        console.log('💾 Saving newly generated questions to database...');
        console.log('Questions to save:', {
          multiple: aiEvaluation.domande_multiple?.length || 0,
          trueFalse: aiEvaluation.domande_vero_falso?.length || 0,
          open: aiEvaluation.domande_aperte?.length || 0,
          total: (aiEvaluation.domande_multiple?.length || 0) + 
                 (aiEvaluation.domande_vero_falso?.length || 0) + 
                 (aiEvaluation.domande_aperte?.length || 0)
        });
        
        // Crea un profilo di default se non esiste
        const profileToUse = userProfile || {
          tipologia_scuola: 'superiori',
          classe: '3A',
          materia: slot.subject_name || 'materia'
        };
        
        console.log('Using profile:', profileToUse);
        
        try {
          const result = await saveGeneratedQuestions(
            aiEvaluation,
            profileToUse,
            aiEvaluation.macroargomenti,
            aiEvaluation.microargomenti,
            slot.subject_name
          );
          console.log('✅ Questions saved successfully:', result);
        } catch (saveError) {
          console.error('❌ Error saving questions to database:', saveError);
        }
      } else {
        console.log('⚠️ Missing required data for saving questions:', {
          hasMacroargomenti: !!aiEvaluation.macroargomenti,
          hasMicroargomenti: !!aiEvaluation.microargomenti,
          macroargomenti: aiEvaluation.macroargomenti,
          microargomenti: aiEvaluation.microargomenti
        });
      }
      
      // Salva la valutazione nel database
      await saveEvaluationToDatabase(aiEvaluation, uploadedUrls);
      
    } catch (error) {
      console.error('Claude evaluation error:', error);
      Alert.alert('Errore', 'Impossibile valutare con AI. Prosegui manualmente.');
      setStep('results');
    } finally {
      setLoading(false);
    }
  };

  const saveEvaluationToDatabase = async (aiEvaluation: any, photoUrls: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('study_evaluations').insert({
        user_id: user.id,
        subject_name: slot.subject_name,
        study_date: new Date().toISOString().split('T')[0],
        actual_duration: actualDuration,
        notes: notes,
        photo_urls: photoUrls,
        ai_evaluation: aiEvaluation,
        quality_score: aiEvaluation.qualita_appunti,
        completeness_score: aiEvaluation.completezza,
        clarity_score: aiEvaluation.chiarezza,
        preparation_score: aiEvaluation.voto_preparazione,
        recommendation: aiEvaluation.raccomandazione
      });
    } catch (error) {
      console.error('Save evaluation error:', error);
    }
  };

  const completeEvaluation = () => {
    onComplete(evaluation);
    navigation.goBack();
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  if (step === 'photos') {
    return (
      <LinearGradient colors={[Colors.background, Colors.backgroundSecondary]} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={24} color={Colors.gray600} />
            </TouchableOpacity>
            <Text style={styles.title}>📸 Valuta Studio</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.subjectInfo}>
            <Text style={styles.subjectName}>{slot.subject_name}</Text>
            <Text style={styles.studyInfo}>
              Studiato per {actualDuration} minuti • {slot.study_type}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📚 Foto delle Pagine Studiate</Text>
            <Text style={styles.sectionDesc}>
              Scatta foto degli appunti, libro o materiale studiato per la valutazione AI
            </Text>

            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                <Ionicons name="camera" size={24} color={Colors.primary} />
                <Text style={styles.photoButtonText}>Scatta Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                <Ionicons name="image" size={24} color={Colors.primary} />
                <Text style={styles.photoButtonText}>Galleria</Text>
              </TouchableOpacity>
            </View>

            {photos.length > 0 && (
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image source={{ uri: photo }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Note Aggiuntive (Opzionale)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Argomenti studiati, difficoltà incontrate, domande..."
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <TouchableOpacity
            style={[styles.continueButton, photos.length === 0 && styles.disabledButton]}
            onPress={() => photos.length > 0 ? evaluateWithClaude() : Alert.alert('⚠️', 'Aggiungi almeno una foto!')}
            disabled={photos.length === 0}
          >
            <Text style={styles.continueButtonText}>
              🤖 Valuta con AI ({photos.length} foto)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setStep('results')}
          >
            <Text style={styles.skipButtonText}>Salta Valutazione AI</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    );
  }

  if (step === 'ai_evaluation' && loading) {
    return (
      <LinearGradient colors={[Colors.primary + '10', Colors.background]} style={styles.container}>
        {/* Header senza bottone indietro durante valutazione */}
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Text style={styles.title}>🤖 Valutazione AI</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>🤖 Claude sta analizzando il tuo studio...</Text>
          <Text style={styles.loadingSubtext}>
            📸 Analisi delle foto completata
          </Text>
          <Text style={styles.loadingSubtext}>
            🧠 Creazione domande intelligenti...
          </Text>
          <Text style={styles.loadingSubtext}>
            🎯 Preparazione sistema adattivo...
          </Text>
          
          <View style={styles.loadingProgressContainer}>
            <Text style={styles.loadingProgressText}>
              Generando 15-20+ domande dinamiche per valutazione completa
            </Text>
            <Text style={styles.loadingWarningText}>
              ⚠️ Non interrompere la valutazione
            </Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (step === 'quiz' && evaluation) {
    const allQuestions = [
      ...(evaluation.domande_multiple || []).map((q: any) => ({ ...q, type: 'multiple' })),
      ...(evaluation.domande_vero_falso || []).map((q: any) => ({ ...q, type: 'true_false' })),
      ...(evaluation.domande_aperte || []).map((q: any) => ({ ...q, type: 'open' }))
    ];
    
    const currentQuestion = allQuestions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex >= allQuestions.length - 1;
    
    return (
      <LinearGradient colors={[Colors.primary + '20', Colors.background]} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.secondary} />
          </TouchableOpacity>
          <Text style={styles.title}>📝 Quiz di Verifica</Text>
          <Text style={styles.questionCounter}>
            {currentQuestionIndex + 1}/{allQuestions.length}
          </Text>
        </View>

        {/* Indicatore di Comprensione */}
        <View style={styles.comprehensionIndicator}>
          <Text style={styles.comprehensionLabel}>
            🎯 Livello Preparazione: {comprehensionLevel}%
          </Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${comprehensionLevel}%` }]} />
          </View>
          <Text style={styles.comprehensionStatus}>
            {getComprehensionStatus(comprehensionLevel)}
          </Text>
        </View>

        <ScrollView style={styles.quizContainer}>
          {/* Argomenti Studiati */}
          {currentQuestionIndex === 0 && evaluation.argomenti_studiati && (
            <View style={styles.topicsCard}>
              <Text style={styles.topicsTitle}>📚 Argomenti studiati:</Text>
              {evaluation.argomenti_studiati.map((topic: string, index: number) => (
                <Text key={index} style={styles.topicItem}>• {topic}</Text>
              ))}
            </View>
          )}

          {/* Domanda Corrente */}
          {currentQuestion && (
            <View style={styles.questionCard}>
              <Text style={styles.difficultyBadge}>
                {currentQuestion.difficolta || 'medio'}
              </Text>
              <Text style={styles.quizQuestionText}>{currentQuestion.domanda}</Text>

              {/* Opzioni Multiple Choice */}
              {currentQuestion.type === 'multiple' && (
                <View style={styles.optionsContainer}>
                  {currentQuestion.opzioni?.map((option: string, index: number) => {
                    const isSelected = userAnswers[currentQuestionIndex] === option;
                    const isCorrect = currentQuestion.risposta_corretta === option;
                    const showFeedback = showCorrection === currentQuestionIndex && isSelected;
                    
                    return (
                      <View key={index}>
                        <TouchableOpacity
                          style={[
                            styles.optionButton,
                            isSelected && styles.selectedOption,
                            showFeedback && isCorrect && styles.correctOption,
                            showFeedback && !isCorrect && styles.wrongOption
                          ]}
                          onPress={() => {
                            const newAnswers = {
                              ...userAnswers,
                              [currentQuestionIndex]: option
                            };
                            setUserAnswers(newAnswers);
                          }}
                          disabled={showCorrection === currentQuestionIndex}
                        >
                          <Text style={[
                            styles.optionText,
                            showFeedback && isCorrect && styles.correctOptionText,
                            showFeedback && !isCorrect && styles.wrongOptionText
                          ]}>{option}</Text>
                        </TouchableOpacity>
                        
                        {/* Feedback immediato */}
                        {showFeedback && (
                          <View style={[
                            styles.feedbackContainer,
                            isCorrect ? styles.correctFeedback : styles.wrongFeedback
                          ]}>
                            <Text style={styles.feedbackText}>
                              {isCorrect 
                                ? `✅ ${currentQuestion.spiegazione_corretta || 'Corretto!'}`
                                : `❌ ${currentQuestion.spiegazione_sbagliate?.[option] || 'Sbagliato!'}`
                              }
                            </Text>
                            {!isCorrect && (
                              <Text style={styles.correctAnswerText}>
                                💡 Risposta corretta: {currentQuestion.risposta_corretta}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                  
                  {/* Feedback generale per Multiple Choice */}
                  {showCorrection === currentQuestionIndex && userAnswers[currentQuestionIndex] && (
                    <View style={[
                      styles.feedbackContainer,
                      userAnswers[currentQuestionIndex] === currentQuestion.risposta_corretta 
                        ? styles.correctFeedback : styles.wrongFeedback
                    ]}>
                      <Text style={styles.feedbackTitle}>
                        {userAnswers[currentQuestionIndex] === currentQuestion.risposta_corretta 
                          ? '✅ Risposta Corretta!' 
                          : '❌ Risposta Sbagliata!'}
                      </Text>
                      <Text style={styles.feedbackText}>
                        💡 La risposta corretta è: {currentQuestion.risposta_corretta}
                      </Text>
                      {currentQuestion.spiegazione_corretta && (
                        <Text style={styles.explanationText}>
                          📚 {currentQuestion.spiegazione_corretta}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Domande Vero/Falso */}
              {currentQuestion.type === 'true_false' && (
                <View>
                  <View style={styles.trueFalseContainer}>
                    {['Vero', 'Falso'].map((option: string) => {
                      const isSelected = userAnswers[currentQuestionIndex] === option;
                      const isCorrect = currentQuestion.risposta_corretta === option;
                      const showFeedback = showCorrection === currentQuestionIndex && isSelected;
                      
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.trueFalseButton,
                            isSelected && styles.selectedTrueFalse,
                            option === 'Vero' ? styles.trueButton : styles.falseButton,
                            showFeedback && isCorrect && styles.correctOption,
                            showFeedback && !isCorrect && styles.wrongOption
                          ]}
                          onPress={() => {
                            const newAnswers = {
                              ...userAnswers,
                              [currentQuestionIndex]: option
                            };
                            setUserAnswers(newAnswers);
                          }}
                          disabled={showCorrection === currentQuestionIndex}
                        >
                          <Text style={[
                            styles.trueFalseText,
                            isSelected && styles.selectedTrueFalseText,
                            showFeedback && isCorrect && styles.correctOptionText,
                            showFeedback && !isCorrect && styles.wrongOptionText
                          ]}>
                            {option === 'Vero' ? '✅ Vero' : '❌ Falso'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  
                  {/* Feedback per Vero/Falso */}
                  {showCorrection === currentQuestionIndex && userAnswers[currentQuestionIndex] && (
                    <View style={[
                      styles.feedbackContainer,
                      userAnswers[currentQuestionIndex] === currentQuestion.risposta_corretta 
                        ? styles.correctFeedback : styles.wrongFeedback
                    ]}>
                      <Text style={styles.feedbackText}>
                        {userAnswers[currentQuestionIndex] === currentQuestion.risposta_corretta 
                          ? `✅ ${currentQuestion[`spiegazione_${userAnswers[currentQuestionIndex].toLowerCase()}`] || 'Corretto!'}`
                          : `❌ Sbagliato! La risposta corretta è: ${currentQuestion.risposta_corretta}`
                        }
                      </Text>
                      <Text style={styles.explanationText}>
                        💡 {currentQuestion[`spiegazione_${currentQuestion.risposta_corretta.toLowerCase()}`]}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Input Domanda Aperta */}
              {currentQuestion.type === 'open' && (
                <View style={styles.openAnswerContainer}>
                  <TextInput
                    style={styles.openAnswerInput}
                    placeholder="Scrivi la tua risposta..."
                    multiline
                    value={userAnswers[currentQuestionIndex] || ''}
                    onChangeText={(text) => setUserAnswers({
                      ...userAnswers,
                      [currentQuestionIndex]: text
                    })}
                  />
                  {currentQuestion.punti_chiave && (
                    <View style={styles.hintsContainer}>
                      <Text style={styles.hintsTitle}>💡 Punti chiave da includere:</Text>
                      {currentQuestion.punti_chiave.map((hint: string, index: number) => (
                        <Text key={index} style={styles.hintText}>• {hint}</Text>
                      ))}
                    </View>
                  )}
                  
                  {/* Correzione dettagliata per domanda aperta */}
                  {userAnswers[currentQuestionIndex] && showCorrection === currentQuestionIndex && (
                    <View style={styles.openAnswerFeedback}>
                      <Text style={styles.feedbackTitle}>🔍 Correzione della tua risposta:</Text>
                      
                      {/* Analisi della risposta utente */}
                      <View style={styles.userAnswerAnalysis}>
                        <Text style={styles.userAnswerLabel}>La tua risposta:</Text>
                        <Text style={styles.userAnswerText}>{userAnswers[currentQuestionIndex]}</Text>
                      </View>
                      
                      {/* Punti mancanti o errati */}
                      {currentQuestion.punti_chiave && (
                        <View style={styles.keyPointsAnalysis}>
                          <Text style={styles.feedbackTitle}>📌 Analisi dei punti chiave:</Text>
                          {currentQuestion.punti_chiave.map((punto: string, index: number) => {
                            const isIncluded = userAnswers[currentQuestionIndex].toLowerCase().includes(punto.toLowerCase());
                            return (
                              <Text key={index} style={[
                                styles.keyPointItem,
                                isIncluded ? styles.keyPointIncluded : styles.keyPointMissing
                              ]}>
                                {isIncluded ? '✅' : '❌'} {punto}
                                {!isIncluded && ' - MANCANTE nella tua risposta'}
                              </Text>
                            );
                          })}
                        </View>
                      )}
                      
                      {/* Correzioni specifiche */}
                      <View style={styles.correctionsSection}>
                        <Text style={styles.feedbackTitle}>✏️ Correzioni e miglioramenti:</Text>
                        <Text style={styles.correctionText}>
                          {(() => {
                            const answer = userAnswers[currentQuestionIndex].toLowerCase();
                            const missingPoints = currentQuestion.punti_chiave?.filter(
                              (p: string) => !answer.includes(p.toLowerCase())
                            ) || [];
                            
                            if (answer.length < 20) {
                              return '⚠️ La tua risposta è troppo breve. Devi sviluppare meglio i concetti e includere più dettagli.';
                            } else if (missingPoints.length === currentQuestion.punti_chiave?.length) {
                              return '❌ La tua risposta non include nessuno dei punti chiave richiesti. Rileggi la domanda e assicurati di rispondere a quanto richiesto.';
                            } else if (missingPoints.length > 0) {
                              return `⚠️ Nella tua risposta mancano questi concetti importanti: ${missingPoints.join(', ')}. Assicurati di includere tutti i punti fondamentali.`;
                            } else {
                              return '✅ Hai incluso i punti chiave! Per migliorare, potresti aggiungere più esempi o approfondimenti.';
                            }
                          })()}
                        </Text>
                      </View>
                      
                      {/* Risposta modello per confronto */}
                      <View style={styles.modelAnswerSection}>
                        <Text style={styles.feedbackTitle}>📚 Risposta completa di riferimento:</Text>
                        <Text style={styles.modelAnswer}>{currentQuestion.risposta_modello}</Text>
                      </View>
                      
                      {/* Spiegazione aggiuntiva se presente */}
                      {currentQuestion.spiegazione_completa && (
                        <View style={styles.explanationSection}>
                          <Text style={styles.feedbackTitle}>💡 Spiegazione approfondita:</Text>
                          <Text style={styles.explanationText}>{currentQuestion.spiegazione_completa}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                </View>
              )}
            </View>
            )}

            {/* Bottone Valuta Risposta */}
            {userAnswers[currentQuestionIndex] && !hasEvaluatedCurrentAnswer && showCorrection !== currentQuestionIndex && (
              <TouchableOpacity
                style={styles.evaluateButton}
                onPress={() => evaluateCurrentAnswer(currentQuestion)}
              >
                <Text style={styles.evaluateButtonText}>🔍 Valuta Risposta</Text>
              </TouchableOpacity>
            )}

          {/* Indicatore generazione nuove domande */}
          {isGeneratingNextQuestion && (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.generatingText}>
                🤖 Generando nuove domande basate sulle tue risposte...
              </Text>
            </View>
          )}

          {/* Bottoni Navigazione */}
          <View style={styles.navigationButtons}>
            {currentQuestionIndex > 0 && (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
              >
                <Text style={styles.navButtonText}>← Precedente</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.primaryButton,
                (!userAnswers[currentQuestionIndex] || !hasEvaluatedCurrentAnswer) && styles.disabledButton
              ]}
              onPress={() => {
                if (isLastQuestion) {
                  // Fine quiz - vai ai risultati
                  setStep('results');
                } else {
                  setCurrentQuestionIndex(currentQuestionIndex + 1);
                  setShowCorrection(null); // Reset correzione per prossima domanda
                  setHasEvaluatedCurrentAnswer(false); // Reset valutazione per prossima domanda
                }
              }}
              disabled={!userAnswers[currentQuestionIndex] || !hasEvaluatedCurrentAnswer}
            >
              <Text style={styles.navButtonText}>
                {isLastQuestion ? 'Termina Quiz ✅' : 'Prossima →'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  if (step === 'ai_evaluation' && evaluation) {
    return (
      <LinearGradient colors={[Colors.background, Colors.backgroundSecondary]} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>🎯 Valutazione AI</Text>
          </View>

          <View style={styles.evaluationCard}>
            <View style={styles.scoreGrid}>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Qualità Appunti</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(evaluation.qualita_appunti) }]}>
                  {evaluation.qualita_appunti}/10
                </Text>
              </View>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Completezza</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(evaluation.completezza) }]}>
                  {evaluation.completezza}/10
                </Text>
              </View>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Chiarezza</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(evaluation.chiarezza) }]}>
                  {evaluation.chiarezza}/10
                </Text>
              </View>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Preparazione</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(evaluation.voto_preparazione) }]}>
                  {evaluation.voto_preparazione}/10
                </Text>
              </View>
            </View>

            <View style={[styles.recommendationBadge, { backgroundColor: getRecommendationColor(evaluation.raccomandazione) }]}>
              <Text style={styles.recommendationText}>
                {getRecommendationText(evaluation.raccomandazione)}
              </Text>
            </View>
          </View>

          {evaluation.feedback && (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>📋 Feedback Dettagliato</Text>
              <Text style={styles.feedbackText}>{evaluation.feedback}</Text>
            </View>
          )}

          {evaluation.domande && evaluation.domande.length > 0 && (
            <View style={styles.questionsCard}>
              <Text style={styles.questionsTitle}>❓ Domande di Verifica</Text>
              {evaluation.domande.map((domanda: string, index: number) => (
                <View key={index} style={styles.questionItem}>
                  <Text style={styles.questionNumber}>{index + 1}.</Text>
                  <Text style={styles.questionText}>{domanda}</Text>
                </View>
              ))}
            </View>
          )}

          {evaluation.suggerimenti && evaluation.suggerimenti.length > 0 && (
            <View style={styles.suggestionsCard}>
              <Text style={styles.suggestionsTitle}>💡 Suggerimenti</Text>
              {evaluation.suggerimenti.map((suggerimento: string, index: number) => (
                <View key={index} style={styles.suggestionItem}>
                  <Text style={styles.suggestionBullet}>•</Text>
                  <Text style={styles.suggestionText}>{suggerimento}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.completeButton} onPress={completeEvaluation}>
            <Text style={styles.completeButtonText}>✅ Completa Sessione</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    );
  }

  // Step results - Report finale di preparazione
  if (step === 'results' && evaluation?.valutazione_finale) {
    // Prepara dati per il calcolo intelligente del voto
    const allQuestions = [
      ...(evaluation.domande_multiple || []).map((q: any) => ({ ...q, type: 'multiple' })),
      ...(evaluation.domande_vero_falso || []).map((q: any) => ({ ...q, type: 'true_false' })),
      ...(evaluation.domande_aperte || []).map((q: any) => ({ ...q, type: 'open' }))
    ];

    const responses = Object.keys(userAnswers).map((questionIndex) => {
      const question = allQuestions[parseInt(questionIndex)];
      const userAnswer = userAnswers[questionIndex];
      let isCorrect = false;
      let partialScore = 0;
      let errorType = '';

      if (question?.type === 'open') {
        // Valutazione semplificata per domande aperte
        const answerLength = userAnswer?.trim()?.length || 0;
        const hasKeywords = question.punti_chiave?.some((keyword: string) => 
          userAnswer?.toLowerCase()?.includes(keyword.toLowerCase())
        ) || false;
        
        if (answerLength < 10) {
          partialScore = 0.2;
          errorType = 'Risposta troppo breve e superficiale';
        } else if (answerLength < 50) {
          partialScore = hasKeywords ? 0.6 : 0.4;
          errorType = hasKeywords ? '' : 'Mancano concetti chiave';
        } else {
          partialScore = hasKeywords ? 0.9 : 0.7;
          isCorrect = partialScore >= 0.7;
        }
      } else {
        isCorrect = question?.risposta_corretta === userAnswer;
        if (!isCorrect) {
          if (question?.type === 'multiple') {
            errorType = 'Errore di comprensione/applicazione';
          } else if (question?.type === 'true_false') {
            errorType = 'Valutazione concettuale errata';
          }
        }
      }

      return {
        isCorrect,
        difficulty: question?.difficolta || 'intermedio',
        questionType: question?.type,
        errorType,
        partialScore
      };
    });

    // Calcola voto intelligente
    const intelligentEvaluation = calculateIntelligentVote(responses);
    
    return (
      <LinearGradient colors={[Colors.primary + '20', Colors.background]} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={Colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.title}>🎯 Report di Preparazione</Text>
          </View>

          {/* Voto Finale Intelligente */}
          <View style={[styles.levelCard, { backgroundColor: getVoteColor(intelligentEvaluation.voto) }]}>
            <Text style={styles.levelTitle}>
              {getVoteEmoji(intelligentEvaluation.voto)} Voto Finale: {intelligentEvaluation.voto}/10
            </Text>
            <Text style={styles.percentageText}>{intelligentEvaluation.diagnosis.diagnosis}</Text>
          </View>

          {/* Analisi Errori */}
          {intelligentEvaluation.errorTypes.length > 0 && (
            <View style={styles.errorAnalysisCard}>
              <Text style={styles.errorAnalysisTitle}>🔍 Analisi Errori:</Text>
              {intelligentEvaluation.errorTypes.map((error: string, index: number) => (
                <Text key={index} style={styles.errorItem}>• {error}</Text>
              ))}
            </View>
          )}

          {/* Punti di Forza */}
          {intelligentEvaluation.strengths.length > 0 && (
            <View style={styles.strengthsCard}>
              <Text style={styles.strengthsTitle}>✅ Punti di Forza:</Text>
              {intelligentEvaluation.strengths.map((strength: string, index: number) => (
                <Text key={index} style={styles.strengthItem}>• {strength}</Text>
              ))}
            </View>
          )}

          {/* Interventi Raccomandati */}
          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsTitle}>🎯 Interventi Raccomandati:</Text>
            {intelligentEvaluation.diagnosis.interventions.map((intervention: string, index: number) => (
              <Text key={index} style={styles.stepText}>• {intervention}</Text>
            ))}
          </View>

          {/* Modifiche Piano Studio */}
          <View style={styles.studyPlanCard}>
            <Text style={styles.studyPlanTitle}>📅 Modifiche Piano Studio:</Text>
            <Text style={styles.timeRecommendation}>
              ⏰ Tempo consigliato: {evaluation.valutazione_finale.tempo_studio_raccomandato}
            </Text>
            <Text style={styles.methodRecommendation}>
              🎓 Metodo: {evaluation.valutazione_finale.piano_studio_modifiche?.metodo_consigliato}
            </Text>
            {evaluation.valutazione_finale.piano_studio_modifiche?.argomenti_prioritari && (
              <View style={styles.priorityContainer}>
                <Text style={styles.priorityTitle}>🔥 Priorità assoluta:</Text>
                {evaluation.valutazione_finale.piano_studio_modifiche.argomenti_prioritari.map((arg: string, index: number) => (
                  <Text key={index} style={styles.priorityItem}>• {arg}</Text>
                ))}
              </View>
            )}
          </View>

          {/* Punti forti e deboli */}
          <View style={styles.strengthsWeaknessesContainer}>
            {evaluation.valutazione_finale.punti_forti?.length > 0 && (
              <View style={styles.strengthsCard}>
                <Text style={styles.strengthsTitle}>✅ Punti forti:</Text>
                {evaluation.valutazione_finale.punti_forti.map((strength: string, index: number) => (
                  <Text key={index} style={styles.strengthItem}>• {strength}</Text>
                ))}
              </View>
            )}

            {evaluation.valutazione_finale.punti_deboli?.length > 0 && (
              <View style={styles.weaknessesCard}>
                <Text style={styles.weaknessesTitle}>⚠️ Da migliorare:</Text>
                {evaluation.valutazione_finale.punti_deboli.map((weakness: string, index: number) => (
                  <Text key={index} style={styles.weaknessItem}>• {weakness}</Text>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.completeButton} onPress={completeEvaluation}>
            <Text style={styles.completeButtonText}>✅ Completa Sessione</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    );
  }

  // Fallback - results senza AI
  return (
    <LinearGradient colors={[Colors.background, Colors.backgroundSecondary]} style={styles.container}>
      <View style={styles.simpleResultContainer}>
        <Text style={styles.simpleResultTitle}>📚 Sessione Completata</Text>
        <Text style={styles.simpleResultText}>
          Hai studiato {slot.subject_name} per {actualDuration} minuti!
        </Text>
        <TouchableOpacity style={styles.completeButton} onPress={completeEvaluation}>
          <Text style={styles.completeButtonText}>✅ Termina</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const getScoreColor = (score: number) => {
  if (score >= 8) return '#4CAF50';
  if (score >= 6) return '#FF9800';
  return '#F44336';
};

const getRecommendationColor = (rec: string) => {
  switch (rec) {
    case 'pronto': return '#4CAF50';
    case 'ripassa': return '#FF9800';
    case 'studia_ancora': return '#F44336';
    default: return Colors.gray400;
  }
};

const getRecommendationText = (rec: string) => {
  switch (rec) {
    case 'pronto': return '🎉 Sei Pronto!';
    case 'ripassa': return '📖 Ripassa';
    case 'studia_ancora': return '📚 Studia Ancora';
    default: return '📋 Valutato';
  }
};

const getLevelColor = (level: string) => {
  switch(level) {
    case 'eccellente': return '#4CAF50';
    case 'buona_preparazione': return '#8BC34A';
    case 'conoscenza_superficiale': return '#FF9800';
    case 'deve_studiare_ancora': return '#F44336';
    default: return Colors.gray400;
  }
};

const getLevelEmoji = (level: string) => {
  switch(level) {
    case 'eccellente': return '🏆 ';
    case 'buona_preparazione': return '✅ ';
    case 'conoscenza_superficiale': return '⚠️ ';
    case 'deve_studiare_ancora': return '📚 ';
    default: return '📝 ';
  }
};

const getLevelText = (level: string) => {
  switch(level) {
    case 'eccellente': return 'Preparazione Eccellente';
    case 'buona_preparazione': return 'Buona Preparazione';
    case 'conoscenza_superficiale': return 'Conoscenza Superficiale';
    case 'deve_studiare_ancora': return 'Devi Studiare Ancora';
    default: return 'Valutazione in corso';
  }
};

// Helper functions per il nuovo sistema di voto
const getVoteColor = (vote: number) => {
  if (vote >= 9) return '#4CAF50'; // Verde eccellente
  if (vote >= 7) return '#8BC34A'; // Verde buono
  if (vote >= 6) return '#FFC107'; // Giallo sufficiente
  if (vote >= 4) return '#FF9800'; // Arancione insufficiente
  return '#F44336'; // Rosso grave
};

const getVoteEmoji = (vote: number) => {
  if (vote >= 9) return '🏆';
  if (vote >= 7) return '✅';
  if (vote >= 6) return '📚';
  if (vote >= 4) return '⚠️';
  return '🚨';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  subjectInfo: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  subjectName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 5,
  },
  studyInfo: {
    fontSize: 14,
    color: Colors.gray600,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 5,
  },
  sectionDesc: {
    fontSize: 14,
    color: Colors.gray600,
    marginBottom: 15,
  },
  photoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  photoButton: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    width: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  photoButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoContainer: {
    position: 'relative',
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'white',
    borderRadius: 15,
  },
  notesInput: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    textAlignVertical: 'top',
    fontSize: 16,
    color: Colors.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 25,
    padding: 18,
    alignItems: 'center',
    marginBottom: 15,
  },
  disabledButton: {
    backgroundColor: Colors.gray400,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    alignItems: 'center',
    padding: 15,
  },
  skipButtonText: {
    color: Colors.gray600,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: Colors.gray600,
    marginTop: 10,
    textAlign: 'center',
  },
  evaluationCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  scoreItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
  },
  scoreLabel: {
    fontSize: 12,
    color: Colors.gray600,
    marginBottom: 5,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  recommendationBadge: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  recommendationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feedbackCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 10,
  },
  questionsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  questionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 15,
  },
  questionItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
    marginRight: 8,
    minWidth: 20,
  },
  questionText: {
    fontSize: 14,
    color: Colors.gray700,
    flex: 1,
    lineHeight: 20,
  },
  quizQuestionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 15,
    lineHeight: 22,
  },
  suggestionsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 15,
  },
  suggestionItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  suggestionBullet: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 8,
    fontWeight: 'bold',
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.gray700,
    flex: 1,
    lineHeight: 20,
  },
  completeButton: {
    backgroundColor: Colors.success,
    borderRadius: 25,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  simpleResultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  simpleResultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 15,
    textAlign: 'center',
  },
  simpleResultText: {
    fontSize: 16,
    color: Colors.gray600,
    textAlign: 'center',
    marginBottom: 30,
  },
  // Quiz Styles
  questionCounter: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  quizContainer: {
    flex: 1,
    padding: 20,
  },
  topicsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  topicsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 10,
  },
  topicItem: {
    fontSize: 14,
    color: Colors.gray700,
    marginBottom: 5,
  },
  questionCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '20',
    color: Colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 15,
  },
  optionsContainer: {
    marginTop: 15,
  },
  optionButton: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  optionText: {
    fontSize: 16,
    color: Colors.secondary,
  },
  openAnswerContainer: {
    marginTop: 15,
  },
  openAnswerInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: Colors.secondary,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  hintsContainer: {
    marginTop: 15,
    backgroundColor: Colors.warning + '10',
    borderRadius: 10,
    padding: 15,
  },
  hintsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.warning,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 13,
    color: Colors.gray700,
    marginBottom: 3,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingBottom: 30,
  },
  navButton: {
    backgroundColor: Colors.gray200,
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  trueFalseContainer: {
    flexDirection: 'row',
    gap: 15,
    marginVertical: 10,
  },
  trueFalseButton: {
    flex: 1,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderLight,
    backgroundColor: 'white',
  },
  trueButton: {
    borderColor: '#22C55E',
  },
  falseButton: {
    borderColor: '#EF4444',
  },
  selectedTrueFalse: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  trueFalseText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.gray700,
  },
  selectedTrueFalseText: {
    color: Colors.primary,
  },
  levelCard: {
    borderRadius: 20,
    padding: 20,
    margin: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  levelTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  percentageText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },
  recommendationCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    margin: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 10,
  },
  strengthsWeaknessesContainer: {
    marginHorizontal: 15,
    gap: 15,
  },
  strengthsCard: {
    backgroundColor: '#E8F5E8',
    borderRadius: 15,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  strengthsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  strengthItem: {
    fontSize: 14,
    color: '#388E3C',
    lineHeight: 20,
  },
  weaknessesCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 15,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  weaknessesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 8,
  },
  weaknessItem: {
    fontSize: 14,
    color: '#F57C00',
    lineHeight: 20,
  },
  // Stili per correzioni immediate
  correctOption: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  wrongOption: {
    borderColor: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  correctOptionText: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  wrongOptionText: {
    color: '#C62828',
    fontWeight: 'bold',
  },
  feedbackContainer: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  correctFeedback: {
    backgroundColor: '#E8F5E8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  wrongFeedback: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  correctAnswerText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.gray600,
  },
  explanationText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.gray600,
    marginTop: 5,
  },
  // Stili per report dettagliato
  nextStepsCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 15,
    padding: 20,
    margin: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 12,
  },
  stepText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 22,
    marginBottom: 8,
  },
  studyPlanCard: {
    backgroundColor: '#F3E5F5',
    borderRadius: 15,
    padding: 20,
    margin: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  studyPlanTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6A1B9A',
    marginBottom: 12,
  },
  timeRecommendation: {
    fontSize: 15,
    color: '#7B1FA2',
    fontWeight: '600',
    marginBottom: 8,
  },
  methodRecommendation: {
    fontSize: 15,
    color: '#7B1FA2',
    fontWeight: '600',
    marginBottom: 10,
  },
  priorityContainer: {
    marginTop: 10,
  },
  priorityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6A1B9A',
    marginBottom: 6,
  },
  priorityItem: {
    fontSize: 13,
    color: '#8E24AA',
    lineHeight: 18,
  },
  // Stili per indicatore di comprensione
  comprehensionIndicator: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comprehensionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: Colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  comprehensionStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
  },
  loadingProgressContainer: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 15,
  },
  loadingProgressText: {
    fontSize: 14,
    color: Colors.gray600,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingWarningText: {
    fontSize: 12,
    color: Colors.warning,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 10,
  },
  generatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '10',
    borderRadius: 10,
    padding: 15,
    marginVertical: 15,
  },
  generatingText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 10,
    textAlign: 'center',
  },
  // Stili per domande aperte
  openAnswerFeedback: {
    marginTop: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  modelAnswer: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
    marginBottom: 10,
  },
  showExplanationButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  showExplanationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Stili per bottone valuta risposta
  evaluateButton: {
    backgroundColor: Colors.warning,
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginVertical: 15,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  evaluateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Stili per analisi errori
  errorAnalysisCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: 15,
    padding: 15,
    margin: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorAnalysisTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C62828',
    marginBottom: 8,
  },
  errorItem: {
    fontSize: 14,
    color: '#D32F2F',
    lineHeight: 20,
    marginBottom: 3,
  },
  // Stili per analisi risposte utente
  userAnswerAnalysis: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  userAnswerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.gray700,
    marginBottom: 5,
  },
  userAnswerText: {
    fontSize: 14,
    color: Colors.gray600,
    lineHeight: 20,
  },
  keyPointsAnalysis: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  keyPointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 5,
  },
  keyPointIncluded: {
    color: '#4CAF50',
    fontSize: 14,
    lineHeight: 20,
  },
  keyPointMissing: {
    color: '#F44336',
    fontSize: 14,
    lineHeight: 20,
  },
  correctionsSection: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  correctionText: {
    fontSize: 14,
    color: '#F57C00',
    lineHeight: 20,
    marginBottom: 10,
  },
  modelAnswerSection: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  explanationSection: {
    backgroundColor: '#F3E5F5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
});