// One-off curation pass (kept for the record): Saṃhitā verses the Upanishads quote outright. "identical" and
// "parallel" roots are checked by wording against the VedAnvaya text at build time; an "echo" (a verse quoted only
// in part) names the quoted words as an IAST keyword. Re-running is harmless: roots already present are skipped, and
// new ones are inserted as text so the hand-kept compact lineage lines stay as they are.
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "data", "curated", "vedic-roots.json");
const ADD = [
  { up: "SvU_2.1", ext: ["YV_11.1"], kind: "parallel", note: "“Harnessing the mind first”: the Agnicayana verses of the Vājasaneyi Saṃhitā, turned to the yoga of meditation." },
  { up: "SvU_2.2", ext: ["YV_11.2"], kind: "parallel", note: "“With the mind harnessed”: the second of the Agnicayana verses." },
  { up: "SvU_2.3", ext: ["YV_11.3"], kind: "parallel", note: "“Having harnessed the gods with the mind”: the third." },
  { up: "SvU_2.4", ext: ["RV_5.81.1"], kind: "identical", note: "“They harness the mind and harness their thoughts”: Śyāvāśva’s hymn to Savitṛ." },
  { up: "SvU_2.5", ext: ["RV_10.13.1"], kind: "parallel", note: "“Hear, all you children of immortality”: the hymn to the two havirdhānas." },
  { up: "SvU_3.3", ext: ["RV_10.81.3"], kind: "identical", note: "“Eyes everywhere, faces everywhere”: Viśvakarman, the All-maker." },
  { up: "SvU_4.8", ext: ["RV_1.164.39"], kind: "identical", note: "“The ṛc in the imperishable highest heaven”: Dīrghatamas’s riddle hymn again." },
  { up: "PU_1.11", ext: ["RV_1.164.12"], kind: "identical", note: "“The five-footed father of twelve forms”: the year, from Dīrghatamas’s riddle hymn." },
  { up: "AiU_2.1.5", ext: ["RV_4.27.1"], kind: "parallel", note: "“While still in the womb I knew all the births of the gods”: Vāmadeva’s own verse." },
  { up: "BU_2.5.16", ext: ["RV_1.116.12"], kind: "parallel", note: "Dadhyañc’s honey-teaching, in Kakṣīvat’s hymn to the Aśvins." },
  { up: "BU_2.5.17", ext: ["RV_1.117.22"], kind: "parallel", note: "The horse’s head given to Dadhyañc, from Kakṣīvat’s second hymn to the Aśvins." },
  { up: "BU_2.5.19", ext: ["RV_6.47.18"], kind: "parallel", note: "“Form after form he took”: Indra of many forms through his māyā." },
  { up: "ChU_3.17.7", ext: ["RV_1.50.10"], kind: "parallel", note: "“Rising above the darkness, beholding the higher light”: the ṛc that closes Ghora Āṅgirasa’s teaching." },
  { up: "ChU_3.17.7", ext: ["RV_8.6.30"], kind: "echo", kw: "pratnasya retasaḥ", note: "“The ancient seed’s light”: the first pāda of a Vatsa hymn to Indra, quoted just before." },
  { up: "BU_6.3.6", ext: ["RV_3.62.10", "RV_1.90.6"], kind: "echo", kw: "tat savitur vareṇyam", note: "The Sāvitrī and “honey the winds blow” recited pāda by pāda in the mantha rite." },
  { up: "MaiU_6.7", ext: ["RV_3.62.10"], kind: "echo", kw: "tatsaviturvareṇyam", note: "The Sāvitrī (Gāyatrī) explained word by word." },
  { up: "BU_1.4.10", ext: ["RV_4.26.1"], kind: "echo", kw: "brahmāsmi", note: "Seeing this, the seer Vāmadeva understood: “I was Manu, and the sun.”" },
  { up: "IU_1", ext: ["YV_40.1"], kind: "identical", note: "The Īśā is the fortieth chapter of the Vājasaneyi Saṃhitā; its first verse." },
];
const src = fs.readFileSync(FILE, "utf8");
const data = JSON.parse(src);
const fresh = ADD.filter((r) => !data.mantraRoots.some((x) => x.up === r.up && x.ext.join() === r.ext.join()));
const start = src.indexOf('"mantraRoots": [');
const close = src.indexOf("\n  ]", start);
const body = fresh.map((r) => JSON.stringify(r, null, 2).split("\n").map((l) => "    " + l).join("\n")).join(",\n");
const out = fresh.length ? src.slice(0, close) + ",\n" + body + src.slice(close) : src;
JSON.parse(out);
fs.writeFileSync(FILE, out);
console.log(`${fresh.length} root(s) added`);
