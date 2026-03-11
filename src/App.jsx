import { useState, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   MUSIC THEORY ENGINE
   ═══════════════════════════════════════════════════════════════════════ */

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTE_MAP = {
  "C":0,"C#":1,"Db":1,"D":2,"D#":3,"Eb":3,"E":4,"F":5,
  "F#":6,"Gb":6,"G":7,"G#":8,"Ab":8,"A":9,"A#":10,"Bb":10,"B":11
};

const CHORD_FORMULAS = {
  "":      { intervals: [0,4,7],       label: "Major" },
  "m":     { intervals: [0,3,7],       label: "Minor" },
  "7":     { intervals: [0,4,7,10],    label: "Dom 7" },
  "m7":    { intervals: [0,3,7,10],    label: "Min 7" },
  "maj7":  { intervals: [0,4,7,11],    label: "Maj 7" },
  "M7":    { intervals: [0,4,7,11],    label: "Maj 7" },
  "6":     { intervals: [0,4,7,9],     label: "6th" },
  "m6":    { intervals: [0,3,7,9],     label: "Min 6" },
  "9":     { intervals: [0,4,7,10,14], label: "9th" },
  "m9":    { intervals: [0,3,7,10,14], label: "Min 9" },
  "add9":  { intervals: [0,2,4,7],     label: "Add 9" },
  "sus2":  { intervals: [0,2,7],       label: "Sus 2" },
  "sus4":  { intervals: [0,5,7],       label: "Sus 4" },
  "sus":   { intervals: [0,5,7],       label: "Sus 4" },
  "dim":   { intervals: [0,3,6],       label: "Dim" },
  "dim7":  { intervals: [0,3,6,9],     label: "Dim 7" },
  "aug":   { intervals: [0,4,8],       label: "Aug" },
  "+":     { intervals: [0,4,8],       label: "Aug" },
  "7sus4": { intervals: [0,5,7,10],    label: "7 Sus 4" },
  "m7b5":  { intervals: [0,3,6,10],    label: "Half Dim" },
  "5":     { intervals: [0,7],         label: "Power" },
  "mmaj7": { intervals: [0,3,7,11],    label: "Min Maj7" },
  "7#9":   { intervals: [0,4,7,10,15], label: "7#9" },
  "7b9":   { intervals: [0,4,7,10,13], label: "7b9" },
  "11":    { intervals: [0,4,7,10,17], label: "11th" },
  "13":    { intervals: [0,4,7,10,21], label: "13th" },
};

const SUFFIX_ALIASES = {
  "min":"m","minor":"m","-":"m","maj":"","major":"",
  "min7":"m7","dom7":"7","o":"dim","°":"dim","ø":"m7b5",
};

function parseChordName(name) {
  const match = name.match(/^([A-G][b#]?)(.*)/);
  if (!match) return null;
  const root = match[1];
  let suffix = match[2];
  const rootIndex = NOTE_MAP[root];
  if (rootIndex === undefined) return null;
  if (SUFFIX_ALIASES[suffix] !== undefined) suffix = SUFFIX_ALIASES[suffix];
  const formula = CHORD_FORMULAS[suffix];
  if (!formula) return null;
  return { root, rootIndex, suffix, intervals: formula.intervals, label: formula.label };
}

/* ─── Transpose ─── */
const FLAT_KEYS = new Set([1,3,5,8,10]);
const SHARP_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT_NAMES =  ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function transposeChordName(name, semitones) {
  const match = name.match(/^([A-G][b#]?)(.*)/);
  if (!match) return name;
  const root = match[1], suffix = match[2];
  const rootIdx = NOTE_MAP[root];
  if (rootIdx === undefined) return name;
  const newIdx = ((rootIdx + semitones) % 12 + 12) % 12;
  const useFlats = root.includes("b") || FLAT_KEYS.has(newIdx);
  return (useFlats ? FLAT_NAMES[newIdx] : SHARP_NAMES[newIdx]) + suffix;
}

function transposeProgression(inputStr, semitones) {
  return inputStr.split(/(\s+|,|\|)/).map(token => {
    const trimmed = token.trim();
    if (!trimmed || /^[\s,|]+$/.test(token)) return token;
    return transposeChordName(trimmed, semitones);
  }).join("");
}

/* ═══════════════════════════════════════════════════════════════════════
   INSTRUMENT DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════ */

const INSTRUMENTS = {
  "piano": {
    name: "Piano",
    type: "piano",
    tuningLabel: "Standard",
  },
  "guitar": {
    name: "Guitar",
    type: "fretted",
    tuningLabel: "EADGBE",
    strings: [
      { name: "E", open: 4, maxFret: 10, canMute: true },
      { name: "A", open: 9, maxFret: 10, canMute: true },
      { name: "D", open: 2, maxFret: 10 },
      { name: "G", open: 7, maxFret: 10 },
      { name: "B", open: 11, maxFret: 10 },
      { name: "e", open: 4, maxFret: 10 },
    ],
    maxSpan: 4,
    minPlayed: 4,
  },
  "bass": {
    name: "Bass",
    type: "bass",
    tuningLabel: "EADG",
    strings: [
      { name: "E", open: 4 },
      { name: "A", open: 9 },
      { name: "D", open: 2 },
      { name: "G", open: 7 },
    ],
    fretsShown: 7,
  },
  "banjo": {
    name: "Banjo",
    type: "fretted",
    tuningLabel: "gDGBD (Open G)",
    strings: [
      { name: "5", open: 7, maxFret: 5, isShort: true, shortFretOffset: 5 },
      { name: "4", open: 2, maxFret: 10 },
      { name: "3", open: 7, maxFret: 10 },
      { name: "2", open: 11, maxFret: 10 },
      { name: "1", open: 2, maxFret: 10 },
    ],
    maxSpan: 4,
    minPlayed: 4,
  },
  "baritone-uke": {
    name: "Bari Uke",
    type: "fretted",
    tuningLabel: "DGBE",
    strings: [
      { name: "D", open: 2, maxFret: 10 },
      { name: "G", open: 7, maxFret: 10 },
      { name: "B", open: 11, maxFret: 10 },
      { name: "E", open: 4, maxFret: 10 },
    ],
    maxSpan: 4,
    minPlayed: 3,
  },
};

/* ═══════════════════════════════════════════════════════════════════════
   FRETTED INSTRUMENT VOICING ENGINE
   ═══════════════════════════════════════════════════════════════════════ */

function computeFrettedVoicings(rootIndex, intervals, instrument) {
  const { strings, maxSpan, minPlayed = 3 } = instrument;
  const numStrings = strings.length;
  const chordTones = new Set(intervals.map(i => (rootIndex + i) % 12));

  const stringOptions = strings.map(s => {
    const frets = [];
    if (s.canMute) frets.push(-1);
    for (let f = 0; f <= s.maxFret; f++) {
      if (chordTones.has((s.open + f) % 12)) frets.push(f);
    }
    return frets;
  });

  const voicings = [];
  const minRequired = Math.min(chordTones.size, 3);

  function generate(idx, current) {
    if (idx === numStrings) { evaluate(current); return; }
    for (const f of stringOptions[idx]) {
      current.push(f);
      generate(idx + 1, current);
      current.pop();
    }
  }

  function evaluate(frets) {
    const played = frets.filter(f => f >= 0);
    if (played.length < minPlayed) return;

    let mutingDone = false;
    for (let i = 0; i < numStrings; i++) {
      if (frets[i] === -1) { if (mutingDone) return; } else { mutingDone = true; }
    }

    const normalPressed = [];
    frets.forEach((f, i) => { if (f > 0 && !strings[i].isShort) normalPressed.push(f); });
    if (normalPressed.length > 0) {
      if (Math.max(...normalPressed) - Math.min(...normalPressed) > maxSpan) return;
    }

    const notesPlayed = new Set();
    frets.forEach((f, i) => { if (f >= 0) notesPlayed.add((strings[i].open + f) % 12); });
    if (!notesPlayed.has(rootIndex)) return;

    const covered = [...chordTones].filter(t => notesPlayed.has(t));
    if (covered.length < minRequired) return;

    if (chordTones.size >= 4 && intervals.length >= 4) {
      const third = (rootIndex + intervals[1]) % 12;
      const seventh = (rootIndex + intervals[3]) % 12;
      if (!notesPlayed.has(third) && !notesPlayed.has(seventh)) return;
    }

    const allPressed = frets.filter(f => f > 0);
    const minP = allPressed.length ? Math.min(...allPressed) : 0;
    const maxP = allPressed.length ? Math.max(...allPressed) : 0;

    let score = 0;
    score -= covered.length * 15;
    score += (normalPressed.length > 0 ? Math.max(...normalPressed) - Math.min(...normalPressed) : 0) * 4;
    score += (minP || 0) * 1.5;
    score += maxP * 0.5;
    const bassIdx = frets.findIndex(f => f >= 0);
    if (bassIdx >= 0 && (strings[bassIdx].open + frets[bassIdx]) % 12 === rootIndex) score -= 10;
    if (allPressed.length > 0 && allPressed.length < numStrings && maxP > 5) score += 3;
    score += new Set(allPressed).size * 1;
    for (let i = 0; i < numStrings - 1; i++) {
      if (frets[i] > 0 && frets[i+1] > 0 && !strings[i].isShort && !strings[i+1].isShort) {
        score += Math.abs(frets[i] - frets[i+1]) * 0.5;
      }
    }
    score -= played.length * 2;
    score += frets.filter(f => f === -1).length * 3;
    strings.forEach((s, i) => { if (s.isShort && frets[i] === 0) score -= 2; });

    voicings.push({ frets: [...frets], score, coverage: covered.length });
  }

  generate(0, []);
  voicings.sort((a, b) => a.score - b.score);

  const seen = new Set();
  const unique = [];
  for (const v of voicings) {
    const key = v.frets.join(",");
    if (!seen.has(key)) { seen.add(key); unique.push(v); }
    if (unique.length >= 6) break;
  }
  return unique;
}

/* ═══════════════════════════════════════════════════════════════════════
   PIANO VOICING ENGINE
   ═══════════════════════════════════════════════════════════════════════ */

function computePianoVoicings(rootIndex, intervals) {
  const baseMidi = 48 + rootIndex;
  const rootPosition = intervals.map(i => baseMidi + i);
  const voicings = [{ notes: rootPosition, label: "Root" }];

  if (intervals.length >= 3) {
    let current = [...rootPosition];
    const invNames = ["1st Inv", "2nd Inv", "3rd Inv"];
    for (let inv = 0; inv < Math.min(intervals.length - 1, 3); inv++) {
      current = [...current];
      current.push(current.shift() + 12);
      voicings.push({ notes: [...current], label: invNames[inv] });
    }
  }
  return voicings;
}

/* ═══════════════════════════════════════════════════════════════════════
   BASS ROOT-NOTE ENGINE
   ═══════════════════════════════════════════════════════════════════════ */

function computeBassPositions(rootIndex, intervals) {
  const root = rootIndex;
  const fifth = (rootIndex + 7) % 12;
  // Also include the minor 3rd and major 3rd for reference
  const third = intervals.includes(3) ? (rootIndex + 3) % 12 :
                intervals.includes(4) ? (rootIndex + 4) % 12 : null;
  return { root, fifth, third };
}

/* ═══════════════════════════════════════════════════════════════════════
   FRETTED DIAGRAM HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

function getDisplayData(frets, instrument) {
  const { strings } = instrument;
  const normalPressed = [];
  frets.forEach((f, i) => { if (f > 0 && !strings[i].isShort) normalPressed.push(f); });

  let baseFret = 1;
  if (normalPressed.length > 0) {
    const minP = Math.min(...normalPressed);
    const maxP = Math.max(...normalPressed);
    if (minP > 4) baseFret = minP;
    else if (maxP > 5 && minP > 2) baseFret = minP;
  }

  const displayFrets = frets.map((f, i) => {
    if (f <= 0) return f;
    if (strings[i].isShort) {
      return (strings[i].shortFretOffset || 0) + f - baseFret + 1;
    }
    return f - baseFret + 1;
  });

  const barres = [];
  const adjusted = frets.map((f, i) => ({
    fret: f, display: displayFrets[i], string: i, isShort: !!strings[i].isShort
  })).filter(x => x.fret > 0 && !x.isShort);

  const groups = {};
  adjusted.forEach(({ display, string }) => {
    if (!groups[display]) groups[display] = [];
    groups[display].push(string);
  });
  Object.entries(groups).forEach(([fStr, strs]) => {
    if (strs.length >= 2) {
      strs.sort((a, b) => a - b);
      let from = strs[0], to = strs[0];
      for (let i = 1; i < strs.length; i++) {
        if (strs[i] === to + 1) { to = strs[i]; }
        else { if (to > from) barres.push({ fret: parseInt(fStr), from, to }); from = strs[i]; to = strs[i]; }
      }
      if (to > from) barres.push({ fret: parseInt(fStr), from, to });
    }
  });

  return { displayFrets, barres, baseFret };
}

function getNoteAt(instrument, stringIndex, fret) {
  const s = instrument.strings[stringIndex];
  return NOTES[((s.open + fret) % 12 + 12) % 12];
}

/* ═══════════════════════════════════════════════════════════════════════
   FRETTED CHORD DIAGRAM COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

const FRETS_SHOWN = 5;

function FrettedDiagram({ name, frets, instrument, voicingIndex, totalVoicings, onPrev, onNext, compact = false, showNotes = false }) {
  const numStrings = instrument.strings.length;

  if (!frets) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:compact?"8px":"12px",
        background:"rgba(180,60,60,0.08)",borderRadius:12,border:"1px solid rgba(180,60,60,0.2)",
        minWidth:compact?70:100 }}>
        <span style={{ fontFamily:"'DM Mono',monospace",fontSize:compact?11:15,fontWeight:700,color:"#b43c3c",marginBottom:4 }}>{name}</span>
        <span style={{ fontSize:10,color:"#b43c3c",opacity:0.7,textAlign:"center" }}>No voicing</span>
      </div>
    );
  }

  const { displayFrets, barres, baseFret } = getDisplayData(frets, instrument);
  const stringSpacing = compact ? (numStrings > 5 ? 13 : 18) : (numStrings > 5 ? 17 : 22);
  const sw = stringSpacing * (numStrings - 1);
  const fretSpacing = compact ? 18 : 24;
  const topPad = compact ? 24 : 30;
  const sidePad = compact ? 14 : 20;
  const nutH = baseFret === 1 ? 4 : 1;
  const svgW = sw + sidePad * 2;
  const svgH = topPad + FRETS_SHOWN * fretSpacing + (compact ? 10 : 16);
  const sx = (i) => sidePad + i * stringSpacing;
  const fy = (f) => topPad + (f - 0.5) * fretSpacing;
  const dotR = compact ? (numStrings > 5 ? 4.5 : 5.5) : (numStrings > 5 ? 6 : 7);

  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:compact?"3px 1px":"5px 3px" }}>
      <span style={{ fontFamily:"'DM Mono',monospace",fontSize:compact?11:15,fontWeight:700,color:"#1a1a2e",marginBottom:1,letterSpacing:0.5 }}>{name}</span>

      {totalVoicings > 1 && !compact && (
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
          <button onClick={onPrev} style={{ background:"none",border:"none",cursor:"pointer",padding:"4px 8px",fontSize:18,color:"#8a8078",fontFamily:"'DM Mono',monospace",borderRadius:4,lineHeight:1 }}>‹</button>
          <span style={{ fontSize:10,color:"#8a8078",fontFamily:"'DM Mono',monospace" }}>{voicingIndex+1}/{totalVoicings}</span>
          <button onClick={onNext} style={{ background:"none",border:"none",cursor:"pointer",padding:"4px 8px",fontSize:18,color:"#8a8078",fontFamily:"'DM Mono',monospace",borderRadius:4,lineHeight:1 }}>›</button>
        </div>
      )}

      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        {baseFret === 1 ? (
          <rect x={sidePad-2} y={topPad-nutH} width={sw+4} height={nutH+1} rx={1} fill="#1a1a2e" />
        ) : (
          <text x={sidePad-10} y={topPad+fretSpacing*0.55} textAnchor="middle" fontSize={9}
            fontFamily="'DM Mono',monospace" fill="#999" fontWeight="600">{baseFret}fr</text>
        )}

        {Array.from({length:FRETS_SHOWN+1}).map((_,i) => (
          <line key={`f${i}`} x1={sidePad} y1={topPad+i*fretSpacing}
            x2={sidePad+sw} y2={topPad+i*fretSpacing}
            stroke="#cdc5bb" strokeWidth={i===0?1.5:1} />
        ))}

        {instrument.strings.map((s,i) => {
          if (s.isShort) {
            const startFret = (s.shortFretOffset||5) - baseFret + 1;
            const startY = startFret>0 && startFret<=FRETS_SHOWN ? topPad+(startFret-1)*fretSpacing : topPad;
            return <line key={`s${i}`} x1={sx(i)} y1={Math.max(startY,topPad)}
              x2={sx(i)} y2={topPad+FRETS_SHOWN*fretSpacing}
              stroke="#9a9288" strokeWidth={0.8} strokeDasharray={startFret<=1?"none":"3,2"} />;
          }
          return <line key={`s${i}`} x1={sx(i)} y1={topPad}
            x2={sx(i)} y2={topPad+FRETS_SHOWN*fretSpacing}
            stroke="#9a9288" strokeWidth={1.0+(numStrings-1-i)*0.12} />;
        })}

        {barres.map((b,bi) => (
          <rect key={`b${bi}`} x={sx(b.from)-dotR+1} y={fy(b.fret)-dotR+1}
            width={sx(b.to)-sx(b.from)+(dotR-1)*2} height={(dotR-1)*2}
            rx={dotR} fill="#1a1a2e" />
        ))}

        {displayFrets.map((df,i) => {
          const actualFret = frets[i];
          const s = instrument.strings[i];
          if (actualFret === -1) {
            return <text key={`x${i}`} x={sx(i)} y={topPad-7} textAnchor="middle" fontSize={compact?9:11}
              fontWeight="700" fill="#b43c3c" fontFamily="'DM Mono',monospace">✕</text>;
          }
          if (actualFret === 0) {
            return <circle key={`o${i}`} cx={sx(i)} cy={topPad-10}
              r={s.isShort?3.5:4.5} fill="none" stroke="#4a7c59" strokeWidth={s.isShort?1.5:2} />;
          }
          if (df < 1 || df > FRETS_SHOWN) return null;
          const isBarre = barres.some(b => b.fret===df && i>=b.from && i<=b.to);
          if (isBarre) {
            if (showNotes) return <text key={`bn${i}`} x={sx(i)} y={fy(df)+3} textAnchor="middle"
              fontSize={compact?6:7} fill="#fff" fontFamily="'DM Mono',monospace" fontWeight="600">
              {getNoteAt(instrument,i,actualFret)}</text>;
            return null;
          }
          const r = s.isShort ? dotR-1 : dotR;
          return (
            <g key={`d${i}`}>
              <circle cx={sx(i)} cy={fy(df)} r={r} fill={s.isShort?"#555":"#1a1a2e"} />
              {showNotes && <text x={sx(i)} y={fy(df)+3} textAnchor="middle"
                fontSize={compact?5:6.5} fill="#fff" fontFamily="'DM Mono',monospace" fontWeight="600">
                {getNoteAt(instrument,i,actualFret)}</text>}
            </g>
          );
        })}

        {showNotes && frets.map((f,i) => f===0 ? (
          <text key={`on${i}`} x={sx(i)} y={topPad-20} textAnchor="middle" fontSize={7}
            fill="#4a7c59" fontFamily="'DM Mono',monospace" fontWeight="600">
            {getNoteAt(instrument,i,0)}</text>
        ) : null)}

        {instrument.strings.map((s,i) => (
          <text key={`l${i}`} x={sx(i)} y={svgH-1} textAnchor="middle" fontSize={compact?7:8}
            fill="#aaa" fontFamily="'DM Mono',monospace">{s.name}</text>
        ))}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   BASS ROOT/FIFTH DIAGRAM COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

function BassDiagram({ name, bassData, compact = false, bassShow = { root: true, fifth: true, third: true } }) {
  const instrument = INSTRUMENTS["bass"];
  const { strings, fretsShown } = instrument;
  const numStrings = strings.length;

  if (!bassData) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:compact?"8px":"12px",
        background:"rgba(180,60,60,0.08)",borderRadius:12,border:"1px solid rgba(180,60,60,0.2)",
        minWidth:compact?70:100 }}>
        <span style={{ fontFamily:"'DM Mono',monospace",fontSize:compact?11:15,fontWeight:700,color:"#b43c3c",marginBottom:4 }}>{name}</span>
        <span style={{ fontSize:10,color:"#b43c3c",opacity:0.7 }}>Unknown</span>
      </div>
    );
  }

  const { root, fifth, third } = bassData;
  const stringSpacing = compact ? 18 : 24;
  const sw = stringSpacing * (numStrings - 1);
  const fretSpacing = compact ? 16 : 20;
  const topPad = compact ? 24 : 30;
  const sidePad = compact ? 14 : 20;
  const svgW = sw + sidePad * 2;
  const svgH = topPad + fretsShown * fretSpacing + (compact ? 10 : 18);
  const sx = (i) => sidePad + i * stringSpacing;
  const fy = (f) => topPad + (f - 0.5) * fretSpacing;
  const dotR = compact ? 5 : 7;

  // Compute which fret positions are root, fifth, third on each string
  const markers = [];
  strings.forEach((s, si) => {
    for (let f = 0; f <= fretsShown; f++) {
      const note = (s.open + f) % 12;
      if (note === root && bassShow.root) markers.push({ si, f, type: "root" });
      else if (note === fifth && bassShow.fifth) markers.push({ si, f, type: "fifth" });
      else if (note === third && bassShow.third) markers.push({ si, f, type: "third" });
    }
  });

  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:compact?"3px 1px":"5px 3px" }}>
      <span style={{ fontFamily:"'DM Mono',monospace",fontSize:compact?11:15,fontWeight:700,color:"#1a1a2e",marginBottom:1,letterSpacing:0.5 }}>{name}</span>

      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        {/* Nut */}
        <rect x={sidePad-2} y={topPad-4} width={sw+4} height={5} rx={1} fill="#1a1a2e" />

        {/* Fret lines */}
        {Array.from({length:fretsShown+1}).map((_,i) => (
          <line key={`f${i}`} x1={sidePad} y1={topPad+i*fretSpacing}
            x2={sidePad+sw} y2={topPad+i*fretSpacing}
            stroke="#cdc5bb" strokeWidth={i===0?1.5:1} />
        ))}

        {/* Fret numbers */}
        {Array.from({length:fretsShown}).map((_,i) => (
          (i+1) % 2 === 1 || i === 0 ? (
            <text key={`fn${i}`} x={sidePad+sw+10} y={topPad+(i+0.5)*fretSpacing+3}
              textAnchor="start" fontSize={compact?7:8} fill="#bbb"
              fontFamily="'DM Mono',monospace">{i+1}</text>
          ) : null
        ))}

        {/* String lines */}
        {strings.map((s,i) => (
          <line key={`s${i}`} x1={sx(i)} y1={topPad}
            x2={sx(i)} y2={topPad+fretsShown*fretSpacing}
            stroke="#9a9288" strokeWidth={1.3+(numStrings-1-i)*0.3} />
        ))}

        {/* Markers */}
        {markers.map((m, mi) => {
          const cx = sx(m.si);
          const cy = m.f === 0 ? topPad - 10 : fy(m.f);
          const noteName = NOTES[(strings[m.si].open + m.f) % 12];

          if (m.type === "root") {
            if (m.f === 0) {
              return (
                <g key={mi}>
                  <circle cx={cx} cy={cy} r={dotR-1} fill="#1a1a2e" />
                  <text x={cx} y={cy+3} textAnchor="middle" fontSize={compact?5:6.5} fill="#fff"
                    fontFamily="'DM Mono',monospace" fontWeight="600">{noteName}</text>
                </g>
              );
            }
            return (
              <g key={mi}>
                <circle cx={cx} cy={cy} r={dotR} fill="#1a1a2e" />
                <text x={cx} y={cy+3} textAnchor="middle" fontSize={compact?5:6.5} fill="#fff"
                  fontFamily="'DM Mono',monospace" fontWeight="600">{noteName}</text>
              </g>
            );
          }
          if (m.type === "fifth") {
            if (m.f === 0) {
              return <circle key={mi} cx={cx} cy={cy} r={dotR-2} fill="none" stroke="#4a7c59" strokeWidth={1.5} />;
            }
            return <circle key={mi} cx={cx} cy={cy} r={dotR-0.5} fill="none" stroke="#4a7c59" strokeWidth={2} />;
          }
          if (m.type === "third") {
            if (m.f === 0) {
              return <circle key={mi} cx={cx} cy={cy} r={dotR-2} fill="none" stroke="#8a7040" strokeWidth={1.5} />;
            }
            return <circle key={mi} cx={cx} cy={cy} r={dotR-0.5} fill="none" stroke="#8a7040" strokeWidth={1.5} strokeDasharray="2,2" />;
          }
          return null;
        })}

        {/* String labels */}
        {strings.map((s,i) => (
          <text key={`l${i}`} x={sx(i)} y={svgH-1} textAnchor="middle" fontSize={compact?7:8}
            fill="#aaa" fontFamily="'DM Mono',monospace">{s.name}</text>
        ))}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PIANO DIAGRAM COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

const IS_BLACK = [false,true,false,true,false,false,true,false,true,false,true,false];

function PianoDiagram({ name, voicing, voicingIndex, totalVoicings, onPrev, onNext, compact = false }) {
  if (!voicing) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:compact?"8px":"12px",
        background:"rgba(180,60,60,0.08)",borderRadius:12,border:"1px solid rgba(180,60,60,0.2)",
        minWidth:compact?70:100 }}>
        <span style={{ fontFamily:"'DM Mono',monospace",fontSize:compact?11:15,fontWeight:700,color:"#b43c3c",marginBottom:4 }}>{name}</span>
        <span style={{ fontSize:10,color:"#b43c3c",opacity:0.7 }}>No voicing</span>
      </div>
    );
  }

  const { notes, label } = voicing;
  const activeNotes = new Set(notes);

  const minNote = Math.min(...notes);
  const maxNote = Math.max(...notes);
  const startMidi = Math.floor(minNote / 12) * 12;
  const endMidi = Math.ceil((maxNote + 1) / 12) * 12 + 12;
  const displayStart = Math.max(startMidi, 36);
  const displayEnd = Math.min(endMidi, 84);

  const whiteKeys = [];
  const blackKeys = [];
  for (let midi = displayStart; midi < displayEnd; midi++) {
    if (IS_BLACK[midi % 12]) blackKeys.push(midi); else whiteKeys.push(midi);
  }

  const wkW = compact ? 16 : 22;
  const wkH = compact ? 60 : 82;
  const bkW = compact ? 10 : 14;
  const bkH = compact ? 38 : 52;
  const totalW = whiteKeys.length * wkW;
  const padX = 6;
  const padTop = compact ? 24 : 34;
  const svgW = totalW + padX * 2;
  const svgH = padTop + wkH + 8;

  const whiteKeyX = {};
  whiteKeys.forEach((midi, i) => { whiteKeyX[midi] = padX + i * wkW; });

  function blackKeyXPos(midi) {
    const n = midi % 12;
    const base = Math.floor(midi / 12) * 12;
    let lower;
    if (n === 1) lower = base;
    else if (n === 3) lower = base + 2;
    else if (n === 6) lower = base + 5;
    else if (n === 8) lower = base + 7;
    else if (n === 10) lower = base + 9;
    else return null;
    if (whiteKeyX[lower] === undefined) return null;
    return whiteKeyX[lower] + wkW - bkW / 2;
  }

  const dotR = compact ? 5 : 8;

  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:compact?"3px 1px":"5px 3px",
      overflowX:"auto",maxWidth:"100%" }}>
      <span style={{ fontFamily:"'DM Mono',monospace",fontSize:compact?11:15,fontWeight:700,color:"#1a1a2e",marginBottom:0,letterSpacing:0.5 }}>{name}</span>

      {totalVoicings > 1 && !compact && (
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:0 }}>
          <button onClick={onPrev} style={{ background:"none",border:"none",cursor:"pointer",padding:"4px 8px",fontSize:18,color:"#8a8078",fontFamily:"'DM Mono',monospace" }}>‹</button>
          <span style={{ fontSize:10,color:"#8a8078",fontFamily:"'DM Mono',monospace" }}>
            {label || `${voicingIndex+1}/${totalVoicings}`}
          </span>
          <button onClick={onNext} style={{ background:"none",border:"none",cursor:"pointer",padding:"4px 8px",fontSize:18,color:"#8a8078",fontFamily:"'DM Mono',monospace" }}>›</button>
        </div>
      )}

      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        {whiteKeys.map(midi => (
          <rect key={`w${midi}`} x={whiteKeyX[midi]} y={padTop} width={wkW-1} height={wkH} rx={2}
            fill="#fff" stroke="#bbb" strokeWidth={0.5} />
        ))}

        {blackKeys.map(midi => {
          const x = blackKeyXPos(midi);
          if (x === null) return null;
          return <rect key={`b${midi}`} x={x} y={padTop} width={bkW} height={bkH} rx={1.5}
            fill="#1a1a2e" stroke="#000" strokeWidth={0.5} />;
        })}

        {whiteKeys.filter(m => activeNotes.has(m)).map(midi => {
          const x = whiteKeyX[midi];
          const cx = x + wkW / 2 - 0.5;
          const cy = padTop + wkH - dotR - (compact ? 5 : 7);
          return (
            <g key={`wd${midi}`}>
              <circle cx={cx} cy={cy} r={dotR} fill="#1a1a2e" />
              <text x={cx} y={cy + (compact ? 3 : 3.5)} textAnchor="middle"
                fontSize={compact ? 6 : 8} fill="#fff" fontFamily="'DM Mono',monospace" fontWeight="600">
                {NOTES[midi % 12]}
              </text>
            </g>
          );
        })}

        {blackKeys.filter(m => activeNotes.has(m)).map(midi => {
          const x = blackKeyXPos(midi);
          if (x === null) return null;
          const cx = x + bkW / 2;
          const cy = padTop + bkH - dotR - (compact ? 3 : 5);
          return (
            <g key={`bd${midi}`}>
              <circle cx={cx} cy={cy} r={dotR - 1} fill="#fff" stroke="#999" strokeWidth={1} />
              <text x={cx} y={cy + (compact ? 2.5 : 3)} textAnchor="middle"
                fontSize={compact ? 5 : 7} fill="#1a1a2e" fontFamily="'DM Mono',monospace" fontWeight="600">
                {NOTES[midi % 12]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   UNIFIED CHORD CARD
   ═══════════════════════════════════════════════════════════════════════ */

function ChordCard({ name, chordData, instrument, voicingIndex, totalVoicings, onPrev, onNext, compact, showNotes, bassShow }) {
  const cardStyle = { background:"#fff",borderRadius:compact?10:14,boxShadow:"0 1px 8px rgba(0,0,0,0.06)",
    border:"1px solid rgba(0,0,0,0.06)",padding:compact?"3px 1px 1px":"5px 3px 3px",overflow:"hidden" };

  if (instrument.type === "piano") {
    const voicing = chordData?.pianoVoicings?.[voicingIndex];
    return (
      <div style={cardStyle}>
        <PianoDiagram name={name} voicing={voicing}
          voicingIndex={voicingIndex} totalVoicings={totalVoicings}
          onPrev={onPrev} onNext={onNext} compact={compact} />
      </div>
    );
  }

  if (instrument.type === "bass") {
    return (
      <div style={cardStyle}>
        <BassDiagram name={name} bassData={chordData?.bassPositions} compact={compact} bassShow={bassShow} />
      </div>
    );
  }

  const voicing = chordData?.voicings?.[voicingIndex];
  return (
    <div style={cardStyle}>
      <FrettedDiagram name={name} frets={voicing?.frets} instrument={instrument}
        voicingIndex={voicingIndex} totalVoicings={totalVoicings}
        onPrev={onPrev} onNext={onNext} compact={compact} showNotes={showNotes} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════ */

function parseChordInput(input) {
  return input.split(/[\s,|]+/).map(s => s.replace(/^[-–]+|[-–]+$/g,"").trim()).filter(Boolean);
}

const DISPLAY_ROOTS = ["C","C#/Db","D","D#/Eb","E","F","F#/Gb","G","G#/Ab","A","A#/Bb","B"];

const SUFFIX_GROUPS = {
  "Triads": ["","m","dim","aug","5"],
  "Sevenths": ["7","m7","maj7","dim7","m7b5","mmaj7"],
  "Extended": ["9","m9","add9","11","13"],
  "Suspended": ["sus2","sus4","7sus4"],
  "Sixths": ["6","m6"],
};

function computeChordData(rootIndex, intervals, instrument) {
  if (instrument.type === "piano") {
    return { pianoVoicings: computePianoVoicings(rootIndex, intervals) };
  }
  if (instrument.type === "bass") {
    return { bassPositions: computeBassPositions(rootIndex, intervals) };
  }
  return { voicings: computeFrettedVoicings(rootIndex, intervals, instrument) };
}

function getVoicingCount(chordData, instrument) {
  if (instrument.type === "piano") return chordData?.pianoVoicings?.length || 0;
  if (instrument.type === "bass") return 1;
  return chordData?.voicings?.length || 0;
}

export default function App() {
  const [instrumentId, setInstrumentId] = useState("piano");
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("progression");
  const [showNotes, setShowNotes] = useState(false);
  const [voicingSelections, setVoicingSelections] = useState({});
  const [libRoot, setLibRoot] = useState("C");
  const [libVoicings, setLibVoicings] = useState({});
  const [transposeAmount, setTransposeAmount] = useState(0);
  const [bassShow, setBassShow] = useState({ root: true, fifth: true, third: false });

  const instrument = INSTRUMENTS[instrumentId];

  const handleInstrumentChange = useCallback((id) => {
    setInstrumentId(id);
    setVoicingSelections({});
    setLibVoicings({});
  }, []);

  const handleTranspose = useCallback((semitones) => {
    setTransposeAmount(prev => prev + semitones);
    setInput(prev => transposeProgression(prev, semitones));
    setVoicingSelections({});
  }, []);

  const chordNames = useMemo(() => parseChordInput(input), [input]);

  const progressionData = useMemo(() => {
    return chordNames.map(name => {
      const parsed = parseChordName(name);
      if (!parsed) return { name, data: null };
      const data = computeChordData(parsed.rootIndex, parsed.intervals, instrument);
      return { name, data, parsed };
    });
  }, [chordNames, instrument]);

  const getVI = useCallback((name, idx) => voicingSelections[`${name}-${idx}`] || 0, [voicingSelections]);

  const cycleVoicing = useCallback((name, idx, dir) => {
    const key = `${name}-${idx}`;
    setVoicingSelections(prev => {
      const chord = progressionData[idx];
      if (!chord?.data) return prev;
      const total = getVoicingCount(chord.data, instrument);
      if (total === 0) return prev;
      const curr = prev[key] || 0;
      return { ...prev, [key]: (curr + dir + total) % total };
    });
  }, [progressionData, instrument]);

  const libraryData = useMemo(() => {
    const rootIdx = NOTE_MAP[libRoot];
    if (rootIdx === undefined) return {};
    const result = {};
    Object.entries(SUFFIX_GROUPS).forEach(([group, suffixes]) => {
      result[group] = suffixes.map(s => {
        const name = libRoot + s;
        const formula = CHORD_FORMULAS[s];
        if (!formula) return { name, data: null, label: s || "Major" };
        const data = computeChordData(rootIdx, formula.intervals, instrument);
        return { name, data, label: formula.label };
      });
    });
    return result;
  }, [libRoot, instrument]);

  const isFretted = instrument.type === "fretted";

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#f5f0e8 0%,#ebe4d8 40%,#e0d8cc 100%)", fontFamily:"'DM Mono',monospace", padding:"16px 8px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

      <style>{`
        @media (max-width: 480px) {
          .inst-btn { font-size: 10px !important; padding: 9px 4px !important; }
          .chord-grid { gap: 8px !important; }
          .lib-grid { gap: 6px !important; }
          .root-btn { padding: 7px 8px !important; font-size: 12px !important; min-width: 38px !important; }
        }
      `}</style>

      <div style={{ maxWidth:900, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(22px, 5vw, 30px)", fontWeight:800, color:"#1a1a2e", margin:0, letterSpacing:-0.5 }}>
            {instrument.name}
          </h1>
          <p style={{ fontSize:11, color:"#8a8078", margin:"4px 0 0", letterSpacing:3, textTransform:"uppercase" }}>
            {instrument.tuningLabel} · {instrument.type === "bass" ? "Root Note Positions" : "Computed Voicings"}
          </p>
        </div>

        {/* Instrument selector */}
        <div style={{ display:"flex", gap:2, marginBottom:14, background:"#2c2c44", borderRadius:10, padding:3,
          maxWidth:620, margin:"0 auto 14px" }}>
          {Object.entries(INSTRUMENTS).map(([id, inst]) => (
            <button key={id} className="inst-btn" onClick={() => handleInstrumentChange(id)} style={{
              flex:"1 1 0", padding:"10px 4px", border:"none", cursor:"pointer", borderRadius:8,
              fontSize:11, fontWeight:500, letterSpacing:0.3, fontFamily:"'DM Mono',monospace",
              background: instrumentId===id ? "#f5f0e8" : "transparent",
              color: instrumentId===id ? "#1a1a2e" : "rgba(245,240,232,0.5)",
              transition:"all 0.2s", minWidth:0, whiteSpace:"nowrap",
            }}>{inst.name}</button>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:0, marginBottom:14, background:"#1a1a2e", borderRadius:10, padding:3, maxWidth:300, margin:"0 auto 14px" }}>
          {["progression","library"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex:1, padding:"10px 0", border:"none", cursor:"pointer", borderRadius:8,
              fontSize:11, fontWeight:500, letterSpacing:1, fontFamily:"'DM Mono',monospace",
              textTransform:"uppercase",
              background: activeTab===tab ? "#f5f0e8" : "transparent",
              color: activeTab===tab ? "#1a1a2e" : "#8a8078",
              transition:"all 0.2s",
            }}>{tab}</button>
          ))}
        </div>

        {/* Show notes toggle (fretted) / Bass layer toggles */}
        {isFretted && (
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
            <button onClick={() => setShowNotes(!showNotes)} style={{
              background: showNotes ? "#1a1a2e" : "#fff",
              color: showNotes ? "#f5f0e8" : "#1a1a2e",
              border:"1px solid #1a1a2e", borderRadius:20, padding:"7px 16px",
              fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace", letterSpacing:1, transition:"all 0.2s",
            }}>{showNotes ? "● " : "○ "}Show Note Names</button>
          </div>
        )}

        {instrument.type === "bass" && (
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:16, flexWrap:"wrap" }}>
            {[
              { key: "root", label: "Root", color: "#1a1a2e", fill: "#1a1a2e", stroke: null },
              { key: "fifth", label: "5th", color: "#4a7c59", fill: "none", stroke: "#4a7c59" },
              { key: "third", label: "3rd", color: "#8a7040", fill: "none", stroke: "#8a7040" },
            ].map(({ key, label, color, fill, stroke }) => {
              const active = bassShow[key];
              return (
                <button key={key} onClick={() => setBassShow(prev => ({ ...prev, [key]: !prev[key] }))} style={{
                  display:"flex", alignItems:"center", gap:6,
                  background: active ? "#fff" : "rgba(255,255,255,0.4)",
                  color: active ? "#1a1a2e" : "#b0a898",
                  border: active ? `2px solid ${color}` : "2px solid transparent",
                  borderRadius:20, padding:"7px 14px",
                  fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace", letterSpacing:0.5,
                  transition:"all 0.2s", opacity: active ? 1 : 0.5,
                }}>
                  <svg width={12} height={12}>
                    <circle cx={6} cy={6} r={5} fill={active ? fill : "none"}
                      stroke={stroke || fill} strokeWidth={1.5}
                      strokeDasharray={key === "third" && active ? "2,2" : "none"} />
                  </svg>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {activeTab === "progression" ? (
          <>
            {/* Input */}
            <div style={{ background:"#fff", borderRadius:14, padding:"12px 14px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", marginBottom:18, border:"1px solid rgba(0,0,0,0.06)" }}>
              <label style={{ fontSize:10, textTransform:"uppercase", letterSpacing:2, color:"#8a8078", display:"block", marginBottom:6 }}>Enter chord progression</label>
              <input type="text" value={input} onChange={(e) => { setInput(e.target.value); setTransposeAmount(0); }} placeholder="e.g. Em G C Am7 D"
                style={{ width:"100%", padding:"10px 0", border:"none", borderBottom:"2px solid #e8e0d4", fontSize:"clamp(14px, 4vw, 18px)", fontFamily:"'DM Mono',monospace", fontWeight:500, color:"#1a1a2e", outline:"none", background:"transparent", letterSpacing:1, boxSizing:"border-box" }} />
              <p style={{ fontSize:10, color:"#b0a898", marginTop:6, marginBottom:0 }}>
                Separate with spaces, commas, or pipes
                {isFretted && " · Use ‹ › to cycle voicings"}
                {instrument.type === "bass" && " · Shows root, 5th, and 3rd positions"}
              </p>
            </div>

            {/* Transpose */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:18 }}>
              <span style={{ fontSize:10, textTransform:"uppercase", letterSpacing:2, color:"#8a8078", fontWeight:500 }}>Transpose</span>
              <div style={{ display:"flex", alignItems:"center", gap:0, background:"#fff", borderRadius:10, border:"1px solid rgba(0,0,0,0.08)", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
                <button onClick={() => handleTranspose(-1)} style={{
                  padding:"10px 16px", border:"none", borderRight:"1px solid rgba(0,0,0,0.08)", cursor:"pointer",
                  background:"transparent", color:"#1a1a2e",
                  fontFamily:"'DM Mono',monospace", fontSize:16, fontWeight:700, lineHeight:1, transition:"background 0.15s",
                }}
                  onMouseEnter={e => e.target.style.background="rgba(26,26,46,0.08)"}
                  onMouseLeave={e => e.target.style.background="transparent"}
                >−</button>
                <span style={{ padding:"10px 16px", fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:600, color:"#1a1a2e", minWidth:36, textAlign:"center", userSelect:"none" }}>
                  {transposeAmount}
                </span>
                <button onClick={() => handleTranspose(1)} style={{
                  padding:"10px 16px", border:"none", borderLeft:"1px solid rgba(0,0,0,0.08)", cursor:"pointer",
                  background:"transparent", color:"#1a1a2e",
                  fontFamily:"'DM Mono',monospace", fontSize:16, fontWeight:700, lineHeight:1, transition:"background 0.15s",
                }}
                  onMouseEnter={e => e.target.style.background="rgba(26,26,46,0.08)"}
                  onMouseLeave={e => e.target.style.background="transparent"}
                >+</button>
              </div>
            </div>

            {/* Diagrams */}
            {progressionData.length > 0 && (
              <div className="chord-grid" style={{ display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center" }}>
                {progressionData.map((chord, i) => {
                  const vi = getVI(chord.name, i);
                  const total = chord.data ? getVoicingCount(chord.data, instrument) : 0;
                  return (
                    <ChordCard key={`${chord.name}-${i}`} name={chord.name}
                      chordData={chord.data} instrument={instrument}
                      voicingIndex={vi} totalVoicings={total}
                      onPrev={() => cycleVoicing(chord.name, i, -1)}
                      onNext={() => cycleVoicing(chord.name, i, 1)}
                      compact={false} showNotes={showNotes} bassShow={bassShow} />
                  );
                })}
              </div>
            )}

            <div style={{ marginTop:20, background:"rgba(255,255,255,0.6)", borderRadius:12, padding:"12px 14px", border:"1px solid rgba(0,0,0,0.04)" }}>
              <p style={{ fontSize:10, color:"#8a8078", margin:0, lineHeight:1.6 }}>
                <strong style={{ color:"#1a1a2e" }}>Supported:</strong>{" "}
                Major, m, 7, m7, maj7, dim, dim7, aug, sus2, sus4, 6, m6, 9, m9, add9, 5, m7b5, mmaj7, 7sus4, 7#9, 7b9, 11, 13
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Root selector */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, justifyContent:"center", marginBottom:18 }}>
              {DISPLAY_ROOTS.map(label => {
                const root = label.split("/")[0];
                return (
                  <button key={label} className="root-btn" onClick={() => setLibRoot(root)} style={{
                    padding:"8px 10px", borderRadius:8, border:"none", cursor:"pointer",
                    background: libRoot===root ? "#1a1a2e" : "#fff",
                    color: libRoot===root ? "#f5f0e8" : "#1a1a2e",
                    fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:600,
                    boxShadow: libRoot===root ? "none" : "0 1px 4px rgba(0,0,0,0.08)",
                    transition:"all 0.15s", minWidth:40,
                  }}>{label}</button>
                );
              })}
            </div>

            {/* Library groups */}
            {Object.entries(libraryData).map(([group, chords]) => (
              <div key={group} style={{ marginBottom:22 }}>
                <h3 style={{ fontSize:10, textTransform:"uppercase", letterSpacing:3, color:"#8a8078", margin:"0 0 8px 4px", fontWeight:500 }}>{group}</h3>
                <div className="lib-grid" style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-start" }}>
                  {chords.map(chord => {
                    const vi = libVoicings[chord.name] || 0;
                    const total = chord.data ? getVoicingCount(chord.data, instrument) : 0;
                    return (
                      <div key={chord.name} style={{ cursor:"pointer" }}
                        onClick={() => { setInput(prev => prev ? `${prev} ${chord.name}` : chord.name); setActiveTab("progression"); }}
                        title={`Add ${chord.name} to progression`}>
                        <ChordCard name={chord.name} chordData={chord.data} instrument={instrument}
                          voicingIndex={vi} totalVoicings={total}
                          onPrev={(e) => { e?.stopPropagation?.(); setLibVoicings(p => ({...p,[chord.name]:((p[chord.name]||0)-1+total)%total})); }}
                          onNext={(e) => { e?.stopPropagation?.(); setLibVoicings(p => ({...p,[chord.name]:((p[chord.name]||0)+1)%total})); }}
                          compact showNotes={showNotes} bassShow={bassShow} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        <p style={{ textAlign:"center", fontSize:10, color:"#b0a898", marginTop:30, letterSpacing:1 }}>
          All voicings computed from intervals · {instrument.tuningLabel}{isFretted ? " tuning" : ""}
        </p>
      </div>
    </div>
  );
}
