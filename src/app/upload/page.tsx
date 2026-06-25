'use client';

import { useState, useRef, type ReactNode } from 'react';

/**
 * Main component for PDF upload and AI processing
 * Handles file upload, drag & drop, and displays AI-generated summaries
 */
type SyllabusData = {
  course_name?: string;
  course_code?: string;
  professor?: {
    name?: string;
    email?: string;
    office_hours?: string;
  };
  class_schedule?: string;
  homework?: Array<{ title: string; due_date: string; due_time?: string; description?: string }>;
  exams?: Array<{ type: string; date: string; time?: string; description?: string }>;
  projects?: Array<{ title: string; due_date: string; due_time?: string; description?: string }>;
  office_hours?: Array<{
    day: string;
    time: string;
    location?: string;
    recurrence?: string;
    start_date: string;
    end_date: string;
  }>;
  class_meetings?: Array<{
    days: string[];
    time: string;
    location?: string;
    recurrence?: string;
    start_date: string;
    end_date: string;
  }>;
};

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const responseText = await response.text();
  if (!responseText) return fallback;

  try {
    const errorJson = JSON.parse(responseText) as {
      error?: string;
      message?: string;
      details?: {
        ocrMessage?: string;
        parserMessage?: string;
        providerMessage?: string;
        code?: string;
      };
    };
    const baseMessage = errorJson.error || errorJson.message || fallback;
    const detailMessage =
      errorJson.details?.ocrMessage ||
      errorJson.details?.parserMessage ||
      errorJson.details?.providerMessage ||
      errorJson.details?.code;

    return detailMessage ? `${baseMessage} ${detailMessage}` : baseMessage;
  } catch {
    return responseText || fallback;
  }
}

export default function UploadPage() {
  // State management for file upload and processing
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<SyllabusData | null>(null);
  const [error, setError] = useState<string>('');
  const [syllabusId, setSyllabusId] = useState<string>('');
  
  // State for multiple syllabi - accumulate all processed courses
  const [allSyllabi, setAllSyllabi] = useState<SyllabusData[]>([]);
  
  // State for humorous summary
  const [isGeneratingHumorous, setIsGeneratingHumorous] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [showTodo, setShowTodo] = useState<boolean>(false);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<'month'|'week'|'day'>('month');
  
  // Ref for the hidden file input element
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handles file selection from the file input
   * @param e - File input change event
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Clear previous results and errors when new file is selected
      setResult(null);
      setError('');
    }
  };

  /**
   * Prevents default drag behavior to allow custom drop handling
   * @param e - Drag over event
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
  };

  /**
   * Handles file drop from drag and drop interface
   * @param e - Drop event
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      // Clear previous results and errors when new file is dropped
      setResult(null);
      setError('');
    }
  };

  /**
   * Processes the uploaded PDF file with Gemini AI
   * Sends file to backend API and handles response
   */
  const handleProcessFile = async (): Promise<void> => {
    if (!file) return;

    setIsProcessing(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const resp = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData
      });
      
      if (!resp.ok) {
        throw new Error(await getApiErrorMessage(resp, 'Failed to process file'));
      }
      
      const data = await resp.json();
      const newSyllabus = data.result as SyllabusData;
      setSyllabusId(data.id || '');
      setResult(newSyllabus);
      
      // Add to accumulated syllabi (avoid duplicates by checking course code)
      if (newSyllabus) {
        setAllSyllabi(prev => {
          const existingIndex = prev.findIndex(s => s.course_code === newSyllabus.course_code);
          if (existingIndex >= 0) {
            // Replace existing syllabus with same course code
            const updated = [...prev];
            updated[existingIndex] = newSyllabus;
            return updated;
          } else {
            // Add new syllabus
            return [...prev, newSyllabus];
          }
        });
      }
    } catch (err) {
      // Handle errors gracefully with user-friendly messages
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Clears the selected file and resets the file input
   */
  const clearFile = (): void => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Generates a humorous summary of the syllabus
   */
  const handleGenerateHumorousSummary = async (): Promise<void> => {
    if (!file) return;

    setIsGeneratingHumorous(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (result) {
        formData.append('syllabus', JSON.stringify(result));
      }

      const response = await fetch('/api/generate-humorous-summary', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Failed to generate humorous summary'));
      }

      const data = await response.json();

      // Trigger audio generation and show bottom loading indicator
      setIsGeneratingAudio(true);
      setAudioUrl('');
      try {
        const audioResponse = await fetch('/api/generate-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: data.result }),
        });
        if (!audioResponse.ok) {
          const audioError = await getApiErrorMessage(audioResponse, 'Audio generation failed');
          console.error('Audio generation failed:', audioError);
          setError(audioError);
          setTimeout(() => setError(''), 3000);
        } else {
          const audioBlob = await audioResponse.blob();
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
        }
      } catch (e) {
        console.error('Audio generation failed', e);
        setError('Audio generation failed');
        setTimeout(() => setError(''), 3000);
      } finally {
        setIsGeneratingAudio(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGeneratingHumorous(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',gap:'32px',padding:'24px',background:'#fef3c7',position:'relative'}}>
      {/* Background shapes */}
      <div className="hb-shape hb-circle" style={{left:-60, top:-40}} />
      <div className="hb-shape hb-circle hb-2" />
      <div className="hb-shape hb-triangle" style={{left: -30, bottom: -20}} />

      <div style={{background:'#fff',borderRadius:'24px',boxShadow:'6px 6px 0 #000, 0 25px 50px -12px rgba(0,0,0,0.25)',width:'100%',maxWidth:'1300px',height:'92vh',display:'flex',padding:'28px',border:'3px solid #000',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:16,left:20,color:'#000',fontWeight:800,fontSize:'36px'}}>Syllable</div>

        {/* Hidden file input for click-to-upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          style={{display:'none'}}
        />

        {/* Left column: big upload button */}
        <div style={{flex:1.5,display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'16px',width:'100%',height:'100%',paddingTop:'72px'}}>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{width:'100%',height:'90%'}}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hb-btn"
                style={{width:'100%',height:'100%',background:'#3b82f6',color:'#fff',fontSize:'32px',fontWeight:800,borderRadius:'14px',boxShadow:'5px 5px 0 #000, 0 12px 18px -4px rgba(0,0,0,0.25)',border:'3px solid #000',cursor:'pointer'}}
              >
                {file ? 'Change PDF' : 'Upload PDF'}
              </button>
            </div>
            {file && (
              <div style={{padding:'8px 10px',border:'3px dashed #000',borderRadius:'10px',background:'#fff',color:'#000'}}>
                <span style={{fontWeight:700,marginRight:'6px',color:'#000'}}>{file.name}</span>
                <span style={{opacity:0.85,color:'#000'}}>({(file.size/1024/1024).toFixed(2)} MB)</span>
                <button onClick={clearFile} style={{marginLeft:12,padding:'4px 8px',border:'2px solid #000',borderRadius:8,background:'#fff',boxShadow:'2px 2px 0 #000',cursor:'pointer'}}>Remove</button>
              </div>
            )}
          </div>
        </div>

        {/* Right column: action buttons */}
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-start',gap:'18px',marginLeft:'24px',position:'relative',zIndex:1}}>
          <button onClick={handleProcessFile} disabled={!file || isProcessing} className="hb-btn" style={{flex:1,background:'#3b82f6',color:'#fff',fontWeight:800,fontSize:'18px',padding:'16px',borderRadius:'12px',boxShadow:'4px 4px 0 #000, 0 12px 18px -4px rgba(0,0,0,0.25)',border:'3px solid #000',cursor:(!file||isProcessing)?'not-allowed':'pointer',opacity:(!file||isProcessing)?0.7:1}}>
            {isProcessing ? 'Processing…' : 'Extract Syllabus'}
          </button>
          <button onClick={()=>setShowCalendar(v=>!v)} disabled={!result} className="hb-btn" style={{flex:1,background:'#22c55e',color:'#fff',fontWeight:800,fontSize:'18px',padding:'16px',borderRadius:'12px',boxShadow:'4px 4px 0 #000, 0 12px 18px -4px rgba(0,0,0,0.25)',border:'3px solid #000',cursor:result? 'pointer':'not-allowed',opacity:result?1:0.7}}>
            {showCalendar ? 'Hide Calendar' : 'Calendar'}
          </button>
          <button onClick={handleGenerateHumorousSummary} disabled={!file || isGeneratingHumorous} className="hb-btn" style={{flex:1,background:'#a855f7',color:'#fff',fontWeight:800,fontSize:'18px',padding:'16px',borderRadius:'12px',boxShadow:'4px 4px 0 #000, 0 12px 18px -4px rgba(0,0,0,0.25)',border:'3px solid #000',cursor:(!file||isGeneratingHumorous)?'not-allowed':'pointer',opacity:(!file||isGeneratingHumorous)?0.7:1}}>
            {isGeneratingHumorous ? 'Summarizing…' : 'Summarize Audio'}
          </button>
          <button onClick={()=>setShowTodo(v=>!v)} disabled={!result} className="hb-btn" style={{flex:1,background:'#ef4444',color:'#fff',fontWeight:800,fontSize:'18px',padding:'16px',borderRadius:'12px',boxShadow:'4px 4px 0 #000, 0 12px 18px -4px rgba(0,0,0,0.25)',border:'3px solid #000',cursor:result?'pointer':'not-allowed',opacity:result?1:0.7}}>
            {showTodo ? 'Hide To-Do' : 'To-Do'}
          </button>
        </div>

        {/* Bottom: errors, results, and audio */}
        <div style={{position:'absolute',left:24,right:24,bottom:24,display:'flex',flexDirection:'column',gap:8,zIndex:5}}>
          {!!error && (
            <div style={{padding:'10px 12px',background:'#ef4444',color:'#fff',border:'3px solid #000',borderRadius:'10px',boxShadow:'3px 3px 0 #000'}}>{error}</div>
          )}
          {isProcessing && (
            <div style={{background:'#3b82f6',color:'#fff',borderRadius:8,boxShadow:'3px 3px 0 #000',padding:'8px 12px',display:'inline-flex',alignItems:'center',gap:8,fontWeight:600}}>
              ⚙️ Processing syllabus...
            </div>
          )}
          {result && !isProcessing && (
            <div style={{background:'#22c55e',color:'#fff',borderRadius:8,boxShadow:'3px 3px 0 #000',padding:'8px 12px',display:'inline-flex',alignItems:'center',gap:8,fontWeight:600}}>
              ✅ Syllabus processed! Found {(result.homework?.length || 0) + (result.exams?.length || 0) + (result.projects?.length || 0)} assignments, {result.office_hours?.length || 0} office hours, {result.class_meetings?.length || 0} class meetings
              {allSyllabi.length > 1 && (
                <span style={{marginLeft:8,opacity:0.9}}>• Total courses: {allSyllabi.length}</span>
              )}
            </div>
          )}
          {isGeneratingAudio && (
            <div style={{background:'#111',color:'#fff',borderRadius:8,boxShadow:'3px 3px 0 #000',padding:'8px 12px',display:'inline-flex',alignItems:'center',gap:8}}>Preparing audio summary…</div>
          )}
          {audioUrl && !isGeneratingAudio && (
            <div style={{background:'#fff',border:'3px solid #000',borderRadius:12,boxShadow:'3px 3px 0 #000',padding:12}}>
              <audio controls src={audioUrl} style={{width:'100%'}} />
            </div>
          )}
        </div>
        {/* To-Do panel (inside board) */}
        {showTodo && (
          <div style={{position:'absolute',inset:'80px 28px 90px 28px',background:'#fff',border:'3px solid #000',borderRadius:'16px',boxShadow:'6px 6px 0 #000',padding:'18px',overflow:'auto',zIndex:2,color:'#000'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
              <div style={{fontWeight:900,fontSize:'24px',color:'#000'}}>To-Do</div>
              <button onClick={()=>setShowTodo(false)} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background:'#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>Close</button>
            </div>
            {(() => {
              const format = (d?: string) => {
                if (!d) return '';
                try { return new Date(d).toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric' }); } catch { return d; }
              };
              
              // Get all assignments from all syllabi
              const allItems: Array<{ title: string; due: string; course: string }> = [];
              
              allSyllabi.forEach(syllabus => {
                const courseName = syllabus.course_name || syllabus.course_code || 'Unknown Course';
                if (syllabus.homework?.length) {
                  syllabus.homework.forEach(h => allItems.push({ title: h.title || 'Assignment', due: format(h.due_date), course: courseName }));
                }
                if (syllabus.projects?.length) {
                  syllabus.projects.forEach(p => allItems.push({ title: p.title || 'Project', due: format(p.due_date), course: courseName }));
                }
                if (syllabus.exams?.length) {
                  syllabus.exams.forEach(e => allItems.push({ title: e.type || 'Exam', due: format(e.date), course: courseName }));
                }
              });
              
              if (allItems.length === 0) {
                return (
                  <div style={{border:'3px solid #000',borderRadius:'12px',padding:'16px',boxShadow:'4px 4px 0 #000',background:'#fff',fontSize:'18px',color:'#000'}}>
                    You are Up to Date with your College Assignments
                  </div>
                );
              }
              
              // Sort by due date
              allItems.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
              
              return (
                <div style={{border:'3px solid #000',borderRadius:'16px',overflow:'hidden',background:'#fff',boxShadow:'4px 4px 0 #000'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 0.8fr 0.8fr'}}>
                    <div style={{padding:'12px 14px',borderBottom:'3px solid #000',borderRight:'3px solid #000',fontWeight:800,color:'#000'}}>Assignment</div>
                    <div style={{padding:'12px 14px',borderBottom:'3px solid #000',borderRight:'3px solid #000',fontWeight:800,color:'#000'}}>Course</div>
                    <div style={{padding:'12px 14px',borderBottom:'3px solid #000',fontWeight:800,color:'#000'}}>Due date</div>
                  </div>
                  {allItems.map((it, idx) => (
                    <div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 0.8fr 0.8fr',borderTop: idx===0? '': '3px solid #000'}}>
                      <div style={{padding:'12px 14px',borderRight:'3px solid #000',color:'#000'}}>{it.title}</div>
                      <div style={{padding:'12px 14px',borderRight:'3px solid #000',color:'#000',fontSize:'14px'}}>{it.course}</div>
                      <div style={{padding:'12px 14px',color:'#000'}}>{it.due || '—'}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Calendar panel (inside board) */}
        {showCalendar && (
          <div style={{position:'absolute',inset:'80px 28px 90px 28px',background:'#fff',border:'3px solid #000',borderRadius:'16px',boxShadow:'6px 6px 0 #000',padding:'18px',overflow:'auto',zIndex:2}}>
            {/* Seasonal accents based on month */}
            {(() => {
              const m = calendarDate.getMonth();
              // December: snowman
              if (m === 11) {
                return (
                  <svg width="140" height="140" style={{position:'absolute',left:14,top:14,opacity:.16}} viewBox="0 0 120 140">
                    <circle cx="60" cy="100" r="28" fill="#e5e7eb" stroke="#000" strokeWidth="2" />
                    <circle cx="60" cy="62" r="20" fill="#e5e7eb" stroke="#000" strokeWidth="2" />
                    <circle cx="53" cy="58" r="2" fill="#000" />
                    <circle cx="67" cy="58" r="2" fill="#000" />
                    <polygon points="60,62 78,66 60,70" fill="#f97316" stroke="#000" strokeWidth="1" />
                  </svg>
                );
              }
              // January: snowflake
              if (m === 0) {
                return (
                  <svg width="140" height="140" style={{position:'absolute',left:14,top:14,opacity:.16}} viewBox="0 0 120 120">
                    <path d="M60 10 V110 M10 60 H110 M25 25 L95 95 M95 25 L25 95" stroke="#60a5fa" strokeWidth="4" />
                  </svg>
                );
              }
              // August/Autumn-ish: leaves
              if (m === 7 || m === 8 || m === 9) {
                return (
                  <svg width="140" height="140" style={{position:'absolute',left:14,top:14,opacity:.16}} viewBox="0 0 120 120">
                    <path d="M60 10 C 90 40, 90 80, 60 110 C 30 80, 30 40, 60 10 Z" fill="#ca8a04" stroke="#000" strokeWidth="1" />
                  </svg>
                );
              }
              // Default: geometric doodle
              return (
                <svg width="120" height="120" style={{position:'absolute',left:14,top:14,opacity:.16}} viewBox="0 0 120 120">
                  <rect x="20" y="20" width="80" height="40" fill="#fde68a" stroke="#000" strokeWidth="2" />
                </svg>
              );
            })()}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
              <div style={{fontWeight:800,fontSize:'24px',color:'#000'}}>Calendar</div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <button onClick={async()=>{
                  try{
                    const backend = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
                    if(!syllabusId){ throw new Error('No syllabus ID'); }
                    const token = typeof window !== 'undefined' ? (localStorage.getItem('access_token') || '') : '';
                    const r = await fetch(`${backend}/calendar/sync/${syllabusId}`,{
                      method:'POST',
                      headers: token ? { Authorization: `Bearer ${token}` } : undefined
                    });
                    if(!r.ok){ throw new Error('Calendar sync failed'); }
                  }catch(e){ setError(e instanceof Error ? e.message : 'Calendar sync failed'); }
                }} disabled={!syllabusId} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background: syllabusId? '#fff':'#f3f4f6',boxShadow:'3px 3px 0 #000',cursor: syllabusId? 'pointer':'not-allowed'}}>Sync to Google</button>
                <button onClick={()=>setCalendarView('month')} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background: calendarView==='month' ? '#e5e7eb' : '#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>Month</button>
                <button onClick={()=>setCalendarView('week')} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background: calendarView==='week' ? '#e5e7eb' : '#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>Week</button>
                <button onClick={()=>setCalendarView('day')} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background: calendarView==='day' ? '#e5e7eb' : '#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>Day</button>
                <button onClick={()=>setShowCalendar(false)} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background:'#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>Close</button>
              </div>
            </div>
            {(() => {
              const map: Record<string, Array<{ title: string }>> = {};
              const addItem = (dateStr?: string, title?: string) => {
                if (!dateStr) return;
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return;
                const key = d.toISOString().slice(0,10);
                (map[key] ||= []).push({ title: title || 'Assignment' });
              };
              result?.homework?.forEach(h => addItem(h.due_date, h.title));
              result?.projects?.forEach(p => addItem(p.due_date, p.title));
              result?.exams?.forEach(e => addItem(e.date, e.type));

              const now = calendarDate;
              const year = now.getFullYear();
              const month = now.getMonth();
              const first = new Date(year, month, 1);
              const last = new Date(year, month + 1, 0);
              const startWeekday = first.getDay();
              const totalDays = last.getDate();

              const isHoliday = (y:number,m:number,day:number) => {
                const wd = new Date(y,m,day).getDay();
                return wd === 0 || wd === 6;
              };
              const renderMonth = () => {
                const cells: ReactNode[] = [];
                for (let i=0;i<startWeekday;i++) cells.push(<div key={'blank-'+i} />);
                for (let day=1; day<=totalDays; day++) {
                  const dateKey = new Date(year,month,day).toISOString().slice(0,10);
                  const items = map[dateKey] || [];
                  const holiday = isHoliday(year,month,day);
                  cells.push(
                    <div key={day} style={{border:'2px solid #000',borderRadius:'10px',padding:'8px',background:'#fff',position:'relative',boxShadow:'3px 3px 0 #000'}}>
                      <div style={{fontWeight:800,color: holiday ? '#dc2626' : '#000'}}>{day}</div>
                      <div style={{marginTop:'6px',display:'flex',flexDirection:'column',gap:'4px'}}>
                        {holiday && <div style={{color:'#dc2626',fontSize:'12px'}}>Holiday</div>}
                        {items.map((it, idx) => (
                          <div key={idx} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                            <span role="img" aria-label="reading">📖</span>
                            <span style={{fontSize:'12px',color:'#000'}}>{it.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px',gap:'8px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        <button onClick={()=>setCalendarDate(new Date(year, month - 1, 1))} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background:'#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>{'<'}</button>
                        <button onClick={()=>setCalendarDate(new Date(year, month + 1, 1))} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background:'#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>{'>'}</button>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <select value={month} onChange={(e)=>setCalendarDate(new Date(year, parseInt(e.target.value,10), 1))} style={{border:'3px solid #000',borderRadius:'10px',padding:'6px 8px',background:'#fff',color:'#000'}}>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((mName, idx)=>(
                            <option key={mName} value={idx}>{mName}</option>
                          ))}
                        </select>
                        <input type="number" value={year} onChange={(e)=>{
                          const y = parseInt(e.target.value,10) || year; setCalendarDate(new Date(y, month, 1));
                        }} style={{width:90,border:'3px solid #000',borderRadius:'10px',padding:'6px 8px',background:'#fff',color:'#000'}} />
                      </div>
                      <div style={{fontWeight:700,color:'#000'}}>{now.toLocaleString(undefined,{month:'long',year:'numeric'})}</div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(7, 1fr)',gap:'10px'}}>
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>
                        <div key={d} style={{textAlign:'center',fontWeight:700,color:'#000'}}>{d}</div>
                      )}
                      {cells}
                    </div>
                  </div>
                );
              };

              const renderWeek = () => {
                const dayOfWeek = new Date(year,month, now.getDate()).getDay();
                const weekStart = new Date(year,month, now.getDate() - dayOfWeek);
                const days: Date[] = Array.from({length:7}, (_,i)=> new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+i));
                return (
                  <div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                      <button onClick={()=>setCalendarDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()-7))} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background:'#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>{'<'}</button>
                      <div style={{fontWeight:700,color:'#000'}}>Week of {weekStart.toLocaleDateString()}</div>
                      <button onClick={()=>setCalendarDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+7))} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background:'#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>{'>'}</button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(7, 1fr)',gap:'10px'}}>
                      {days.map((d,i)=>{
                        const key = d.toISOString().slice(0,10);
                        const items = map[key] || [];
                        const holiday = isHoliday(d.getFullYear(), d.getMonth(), d.getDate());
                        return (
                          <div key={i} style={{border:'2px solid #000',borderRadius:'10px',padding:'8px',background:'#fff',position:'relative',boxShadow:'3px 3px 0 #000'}}>
                            <div style={{fontWeight:800,color: holiday ? '#dc2626' : '#000'}}>{d.toLocaleDateString(undefined,{weekday:'short', day:'numeric'})}</div>
                            <div style={{marginTop:'6px',display:'flex',flexDirection:'column',gap:'4px'}}>
                              {holiday && <div style={{color:'#dc2626',fontSize:'12px'}}>Holiday</div>}
                              {items.map((it, idx) => (
                                <div key={idx} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                                  <span role="img" aria-label="reading">📖</span>
                                  <span style={{fontSize:'12px',color:'#000'}}>{it.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              const renderDay = () => {
                const hours = Array.from({length:24}, (_,i)=> i);
                return (
                  <div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                      <button onClick={()=>setCalendarDate(new Date(year, month, now.getDate()-1))} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background:'#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>{'<'}</button>
                      <div style={{fontWeight:700,color:'#000'}}>{now.toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'})}</div>
                      <button onClick={()=>setCalendarDate(new Date(year, month, now.getDate()+1))} className="hb-btn" style={{padding:'6px 10px',border:'3px solid #000',borderRadius:'10px',background:'#fff',boxShadow:'3px 3px 0 #000',cursor:'pointer'}}>{'>'}</button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr',gap:'6px'}}>
                      {hours.map(h=>{
                        const label = `${String(h).padStart(2,'0')}:00`;
                        return (
                          <div key={h} style={{display:'grid',gridTemplateColumns:'80px 1fr',alignItems:'start',gap:'8px'}}>
                            <div style={{fontWeight:700,color:'#000'}}>{label}</div>
                            <div style={{border:'2px dashed #000',borderRadius:'10px',minHeight:'28px',background:'#fff'}} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              if (calendarView==='week') return renderWeek();
              if (calendarView==='day') return renderDay();
              return renderMonth();
            })()}
          </div>
        )}
      </div>
      {/* About Us & Features whiteboard (restored) */}
      <div style={{background:'#fff',borderRadius:'24px',boxShadow:'6px 6px 0 #000, 0 18px 36px -12px rgba(0,0,0,0.2)',width:'100%',maxWidth:'1100px',padding:'28px',border:'3px solid #000',position:'relative'}}>
        <div style={{position:'absolute',top:16,left:20,color:'#000',fontWeight:800,fontSize:'30px'}}>About Us</div>
        <div style={{marginTop:'64px',color:'#111',fontSize:'18px',lineHeight:1.5}}>
          <p style={{marginBottom:'12px'}}>We built Syllable to turn dense course syllabi into actionable plans with a friendly, handwritten whiteboard experience.</p>
          <p style={{marginBottom:'20px'}}>Upload a PDF to extract deadlines, generate audio summaries, and keep track of what matters most each week.</p>
          <div style={{fontWeight:800,fontSize:'26px',marginTop:'12px',marginBottom:'12px'}}>Our Features</div>
          <ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',gap:'12px'}}>
            <li style={{border:'3px solid #000',borderRadius:'12px',padding:'12px',boxShadow:'4px 4px 0 #000',background:'#fff'}}>PDF parsing for assignments, exams, and projects</li>
            <li style={{border:'3px solid #000',borderRadius:'12px',padding:'12px',boxShadow:'4px 4px 0 #000',background:'#fff'}}>Auto-detected key dates ready for calendar sync</li>
            <li style={{border:'3px solid #000',borderRadius:'12px',padding:'12px',boxShadow:'4px 4px 0 #000',background:'#fff'}}>Humorous, high-level summaries with optional audio</li>
            <li style={{border:'3px solid #000',borderRadius:'12px',padding:'12px',boxShadow:'4px 4px 0 #000',background:'#fff'}}>Simple, focus-first whiteboard interface</li>
          </ul>
        </div>
      </div>

        {/* Removed external To-Do board; now appears inside the To-Do button panel */}
    </div>
  );
}
