import { useEffect,useRef,useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import DeskScene from '@/components/magical/DeskScene';
import Arrival from '@/components/magical/Arrival';
import LetterCarousel from '@/components/magical/LetterCarousel';
import ConfirmationSlip from '@/components/magical/ConfirmationSlip';
import OpeningSequence from '@/components/magical/OpeningSequence';
import ReadingMode from '@/components/magical/ReadingMode';
import RevealNote from '@/components/magical/RevealNote';
import NameEntry from '@/components/magical/NameEntry';
import { letters } from '@/components/magical/letterData';
import { tracker } from '@/lib/tracker';

const newTimer=()=>({started:false,activeSince:null,elapsed:0,submitted:false,requestId:null});

export default function Home(){
 const [scene,setScene]=useState('name'),[selected,setSelected]=useState(0),[read,setRead]=useState(new Set()),[name,setName]=useState('');
 const [admin,setAdmin]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [firstDone,setFirstDone]=useState(false);
 const timing=useRef(newTimer()),pending=useRef(false);
 const navigate=useNavigate();
 const letter=letters[selected];
 useEffect(()=>{let active=true;tracker('status').then(status=>{if(!active)return;setAdmin(status.admin);if(status.admin&&new URLSearchParams(window.location.search).get('test')==='1'){setName('Admin');setScene('arrival')}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[]);
 useEffect(()=>{const esc=e=>e.key==='Escape'&&scene==='reading'&&closeLetter();window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[scene,firstDone]);
 useEffect(()=>{if(scene==='browse'&&!timing.current.started){timing.current.started=true;timing.current.activeSince=document.hidden?null:performance.now()}},[scene]);
 useEffect(()=>{const visibility=()=>{const timer=timing.current;if(!timer.started||timer.submitted)return;if(document.hidden&&timer.activeSince!==null){timer.elapsed+=performance.now()-timer.activeSince;timer.activeSince=null}else if(!document.hidden&&timer.activeSince===null)timer.activeSince=performance.now()};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility)},[]);
 const begin=async n=>{
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{
   try{await tracker('login',{password:n});navigate('/admin');return}catch(e){if(e.status!==401)throw e}
   if(n.length>32)throw new Error('Please enter a name of 32 characters or fewer, or the correct admin password.');
   const status=await tracker('status');setAdmin(status.admin);
   setName(n);timing.current=newTimer();setFirstDone(false);setScene('arrival');
  }catch(e){setError(e.message)}finally{pending.current=false;setBusy(false)}
 };
 const closeLetter=()=>{setRead(s=>new Set(s).add(letter.id));timing.current=newTimer();setScene(firstDone?'browse':'reveal')};
 const choose=()=>{if(!pending.current){timing.current.requestId=crypto.randomUUID();setError('');setScene('confirm')}};
 const openLetter=async()=>{
  const timer=timing.current;if(pending.current||timer.submitted)return;
  pending.current=true;setBusy(true);setError('');
  if(timer.activeSince!==null){timer.elapsed+=performance.now()-timer.activeSince;timer.activeSince=null}
  timer.submitted=true;
  try{await tracker('',{name,letterId:letter.id,durationMs:Math.min(86_400_000,Math.round(timer.elapsed)),requestId:timer.requestId,adminTest:admin});setScene('opening')}
  catch(e){timer.submitted=false;timer.activeSince=document.hidden?null:performance.now();setError(e.message)}
  finally{pending.current=false;setBusy(false)}
 };
 const resetTest=()=>{if(!pending.current){timing.current=newTimer();setFirstDone(false);setError('');setScene('arrival')}};
 return <DeskScene close={scene==='opening'||scene==='reading'}>
  {admin&&<nav aria-label="Admin testing" className="fixed top-4 right-4 z-[100] flex gap-4 rounded bg-slate-950 px-4 py-3 text-white"><Link to="/admin">Admin records</Link><button onClick={resetTest} disabled={busy}>Choose again</button></nav>}
  <AnimatePresence mode="wait">
  {scene==='name'&&<NameEntry key="name" onContinue={begin} busy={busy} error={error}/>}
  {scene==='arrival'&&<Arrival key="arrival" letters={letters} onContinue={()=>setScene('browse')}/>} 
  {scene==='browse'&&<LetterCarousel key="browse" letters={letters} selected={selected} setSelected={setSelected} read={read} onChoose={choose}/>} 
  {scene==='confirm'&&<><LetterCarousel key="under" letters={letters} selected={selected} setSelected={setSelected} read={read} onChoose={choose}/><ConfirmationSlip key="confirm" letter={letter} first={!firstDone} busy={busy} error={error} onYes={openLetter} onNo={()=>setScene('browse')}/></>}
  {scene==='opening'&&<OpeningSequence key={letter.id+'open'} letter={letter} onComplete={()=>setScene('reading')}/>} 
  {scene==='reading'&&<ReadingMode key={letter.id+'read'} letter={letter} onClose={closeLetter}/>} 
  {scene==='reveal'&&<RevealNote key="reveal" onContinue={()=>{setFirstDone(true);setScene('browse')}}/>}
 </AnimatePresence></DeskScene>;
}
