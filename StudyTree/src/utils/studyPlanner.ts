// Sistema di pianificazione automatica dello studio

interface Event {
  id: string;
  title: string;
  subject: string;
  exam_date: string;
  difficulty: number;
  estimated_study_hours: number;
  event_type: 'verifica' | 'interrogazione' | 'sport' | 'spostamento' | 'altro';
}

interface StudySession {
  date: string;
  time: string;
  duration: number; // minuti
  subject: string;
  examId: string;
  examTitle: string;
  examDate: string;
  priority: 'alta' | 'media' | 'bassa';
  pomodorosNeeded: number;
}

interface DailyPlan {
  date: string;
  sessions: StudySession[];
  totalPomodoros: number;
  totalMinutes: number;
}

export class StudyPlanner {
  private readonly POMODORO_DURATION = 25; // minuti
  private readonly MAX_DAILY_POMODOROS = 8; // massimo 8 pomodori al giorno (3.3 ore)
  private readonly MIN_DAILY_POMODOROS = 2; // minimo 2 pomodori al giorno
  
  // Ore preferite per studiare (pomeriggio/sera)
  private readonly STUDY_SLOTS = [
    { time: '15:00', available: true },
    { time: '16:00', available: true },
    { time: '17:00', available: true },
    { time: '18:30', available: true },
    { time: '20:30', available: true },
    { time: '21:30', available: true },
  ];

  /**
   * Genera un piano di studio automatico basato sugli eventi
   */
  generateStudyPlan(events: Event[], fromDate: Date = new Date()): DailyPlan[] {
    const studyEvents = events.filter(e => 
      (e.event_type === 'verifica' || e.event_type === 'interrogazione') &&
      new Date(e.exam_date) > fromDate
    );

    if (studyEvents.length === 0) {
      return [];
    }

    // Ordina per priorità (data più vicina e difficoltà)
    const prioritizedEvents = this.prioritizeEvents(studyEvents, fromDate);
    
    // Calcola sessioni necessarie per ogni evento
    const sessionsByEvent = this.calculateSessionsNeeded(prioritizedEvents);
    
    // Distribuisci le sessioni nei giorni disponibili
    const dailyPlans = this.distributeSessionsOverDays(sessionsByEvent, fromDate);
    
    return dailyPlans;
  }

  /**
   * Prioritizza gli eventi in base a data e difficoltà
   */
  private prioritizeEvents(events: Event[], fromDate: Date): Event[] {
    return events.sort((a, b) => {
      const daysUntilA = this.getDaysUntil(a.exam_date, fromDate);
      const daysUntilB = this.getDaysUntil(b.exam_date, fromDate);
      
      // Urgenza: peso maggiore per esami vicini
      const urgencyA = (10 - Math.min(daysUntilA, 10)) * 3;
      const urgencyB = (10 - Math.min(daysUntilB, 10)) * 3;
      
      // Score totale: urgenza + difficoltà
      const scoreA = urgencyA + a.difficulty;
      const scoreB = urgencyB + b.difficulty;
      
      return scoreB - scoreA;
    });
  }

  /**
   * Calcola il numero di sessioni necessarie per ogni evento
   */
  private calculateSessionsNeeded(events: Event[]): Map<Event, number> {
    const sessionMap = new Map<Event, number>();
    
    events.forEach(event => {
      // Converti ore di studio in sessioni Pomodoro (25 min ciascuna)
      const pomodorosNeeded = Math.ceil((event.estimated_study_hours * 60) / this.POMODORO_DURATION);
      
      // Aggiungi sessioni extra per difficoltà alta
      const difficultyBonus = event.difficulty >= 4 ? Math.ceil(pomodorosNeeded * 0.2) : 0;
      
      sessionMap.set(event, pomodorosNeeded + difficultyBonus);
    });
    
    return sessionMap;
  }

  /**
   * Distribuisce le sessioni di studio nei giorni disponibili
   */
  private distributeSessionsOverDays(
    sessionsByEvent: Map<Event, number>,
    fromDate: Date
  ): DailyPlan[] {
    const dailyPlans: DailyPlan[] = [];
    const today = new Date(fromDate);
    today.setHours(0, 0, 0, 0);
    
    // Per ogni giorno fino all'ultimo esame
    const lastExamDate = this.getLastExamDate(Array.from(sessionsByEvent.keys()));
    const totalDays = this.getDaysUntil(lastExamDate, today);
    
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      
      const dailySessions: StudySession[] = [];
      let dailyPomodoros = 0;
      
      // Per ogni evento, vedi se serve studiare oggi
      sessionsByEvent.forEach((pomodorosNeeded, event) => {
        if (pomodorosNeeded <= 0) return;
        
        const daysUntilExam = this.getDaysUntil(event.exam_date, currentDate);
        if (daysUntilExam <= 0) return;
        
        // Calcola pomodori per oggi per questo evento
        const pomodorosPerDay = Math.ceil(pomodorosNeeded / daysUntilExam);
        const pomodorosToday = Math.min(
          pomodorosPerDay,
          this.MAX_DAILY_POMODOROS - dailyPomodoros,
          pomodorosNeeded
        );
        
        if (pomodorosToday > 0 && dailyPomodoros < this.MAX_DAILY_POMODOROS) {
          // Trova slot temporale disponibile
          const timeSlot = this.STUDY_SLOTS[dailySessions.length % this.STUDY_SLOTS.length];
          
          dailySessions.push({
            date: currentDate.toISOString().split('T')[0],
            time: timeSlot.time,
            duration: pomodorosToday * this.POMODORO_DURATION,
            subject: event.subject,
            examId: event.id,
            examTitle: event.title,
            examDate: event.exam_date,
            priority: daysUntilExam <= 3 ? 'alta' : daysUntilExam <= 7 ? 'media' : 'bassa',
            pomodorosNeeded: pomodorosToday
          });
          
          dailyPomodoros += pomodorosToday;
          sessionsByEvent.set(event, pomodorosNeeded - pomodorosToday);
        }
      });
      
      if (dailySessions.length > 0) {
        dailyPlans.push({
          date: currentDate.toISOString().split('T')[0],
          sessions: dailySessions,
          totalPomodoros: dailyPomodoros,
          totalMinutes: dailyPomodoros * this.POMODORO_DURATION
        });
      }
    }
    
    return dailyPlans;
  }

  /**
   * Calcola giorni fino a una data
   */
  private getDaysUntil(targetDate: string, fromDate: Date): number {
    const target = new Date(targetDate);
    const from = new Date(fromDate);
    target.setHours(0, 0, 0, 0);
    from.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - from.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Trova la data dell'ultimo esame
   */
  private getLastExamDate(events: Event[]): string {
    return events.reduce((latest, event) => {
      return new Date(event.exam_date) > new Date(latest) ? event.exam_date : latest;
    }, events[0].exam_date);
  }

  /**
   * Genera suggerimenti di studio per oggi
   */
  getTodayPlan(allPlans: DailyPlan[]): DailyPlan | null {
    const today = new Date().toISOString().split('T')[0];
    return allPlans.find(plan => plan.date === today) || null;
  }

  /**
   * Calcola statistiche del piano
   */
  getPlanStats(plans: DailyPlan[]) {
    const totalPomodoros = plans.reduce((sum, plan) => sum + plan.totalPomodoros, 0);
    const totalHours = (totalPomodoros * this.POMODORO_DURATION) / 60;
    const avgPomodorosPerDay = plans.length > 0 ? totalPomodoros / plans.length : 0;
    
    return {
      totalDays: plans.length,
      totalPomodoros,
      totalHours: totalHours.toFixed(1),
      avgPomodorosPerDay: avgPomodorosPerDay.toFixed(1)
    };
  }
}