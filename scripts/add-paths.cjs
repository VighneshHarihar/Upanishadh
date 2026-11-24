// One-off curation pass (kept for the record): two guided paths for the Living Plates — the five sheaths of the
// Taittirīya and the four states of the Māṇḍūkya. Every step carries an IAST keyword checked by the integrity gate.
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "data", "curated", "paths.json");
const NEW = [
  {
    id: "sheaths",
    title: "The Five Sheaths",
    subtitle: "From food to bliss",
    minutes: 8,
    intro: "The Taittirīya peels the person like a fruit: a self made of food, and within it one of breath, of mind, of understanding, and of bliss. Each layer is real while it lasts, and none of them is the last word.",
    steps: [
      { node: "TU_2.1", kw: "satyaṃ jñānamanantaṃ brahma", kind: "read", title: "The person made of food", note: "Brahman is truth, knowledge, the infinite, hidden in the cave of the heart. From it came space, air, fire, water, earth, plants, food, and the person made of the essence of food: the first and outermost sheath.", prompt: "How much of what you call ‘me’ is this body?" },
      { node: "TU_2.2", kw: "prajāḥ prajāyante", kind: "read", title: "Within it, breath", note: "Creatures are born from food, live by it, and return to it. Within the self of food is another, made of breath (prāṇa), filling it like a mould.", prompt: "What keeps you alive that you never decide?" },
      { node: "TU_2.3", kw: "prāṇaṃ devā anu prāṇanti", kind: "read", title: "Within breath, mind", note: "Gods, people and animals breathe after breath; it is the life of beings. Within the self of breath is one made of mind (manas), whose head is the Yajus and whose body is the Vedas’ teaching.", prompt: "Which of your thoughts did you choose today?" },
      { node: "TU_2.4", kw: "yato vāco nivartante", kind: "read", title: "Within mind, understanding", note: "Words turn back from it, with the mind, unable to reach it; one who knows the bliss of Brahman fears nothing. Within the self of mind is one made of understanding (vijñāna).", prompt: "Where does knowing something differ from thinking about it?" },
      { node: "TU_2.5", kw: "vijñānaṃ yajñaṃ tanute", kind: "read", title: "Within understanding, bliss", note: "Understanding carries out the sacrifice and every act. Within it is the self made of bliss (ānanda): joy its head, delight and great delight its wings, and Brahman its foundation.", prompt: "What is the joy that needs no reason?" },
      { node: "TU_3.6", kw: "ānando brahmeti vyajānāt", kind: "read", title: "Bhṛgu arrives", note: "Bhṛgu, taught only ‘inquire’, went through food, breath, mind and understanding, and at last knew bliss as Brahman: from bliss beings are born, by bliss they live, into bliss they return.", prompt: "Which layer did you stop at, last time you asked who you are?" },
      { node: "reflect", kind: "reflect", title: "In your own words", note: "Each sheath is a true description and an incomplete one. The teaching does not discard the body or the mind; it refuses to stop there.", prompt: "What would you lose, and what would remain, if you were not your moods?" },
    ],
  },
  {
    id: "four-states",
    title: "The Four States",
    subtitle: "Waking, dream, deep sleep, and the fourth",
    minutes: 6,
    intro: "The Māṇḍūkya is twelve verses long and maps the whole of experience onto one syllable: A for waking, U for dream, M for deep sleep, and the silence after OM for the fourth, which is not a state at all.",
    steps: [
      { node: "MaU_2", kw: "brahmāyamātmā", kind: "read", title: "This self is Brahman", note: "All this is Brahman; this self is Brahman; and this self has four quarters.", prompt: "What in you has been present for every day of your life?" },
      { node: "MaU_3", kw: "jāgaritasthāno", kind: "read", title: "Waking: A", note: "The first quarter is Vaiśvānara, whose field is waking, knowing outward, enjoying the gross.", prompt: "How much of your waking day is spent outside yourself?" },
      { node: "MaU_4", kw: "svapnasthāno", kind: "read", title: "Dream: U", note: "The second is Taijasa, whose field is dream, knowing inward, enjoying the subtle.", prompt: "Who was watching your last dream?" },
      { node: "MaU_5", kw: "suṣuptasthāna", kind: "read", title: "Deep sleep: M", note: "The third is Prājña: in deep sleep one desires nothing and sees no dream; a mass of consciousness, made of bliss, the doorway to the knowing of the other two.", prompt: "What did you lack in dreamless sleep?" },
      { node: "MaU_7", kw: "nāntaḥprajñaṃ", kind: "read", title: "The fourth", note: "Not knowing inward, not knowing outward, not a mass of knowing: unseen, beyond dealings, peaceful, auspicious, without a second. That is the self; that is to be known.", prompt: "Can you notice what does not change when the states change?" },
      { node: "MaU_12", kw: "amātraścaturtho", kind: "read", title: "The silence after the sound", note: "The fourth has no measure: the end of the world’s play, peaceful, auspicious, non-dual. So OM is the self, and one who knows this enters the self by the self.", prompt: "What is left when the sound of OM fades?" },
      { node: "reflect", kind: "reflect", title: "In your own words", note: "The three states come and go; the Māṇḍūkya points at what they come and go in.", prompt: "Which state do you mistake for the whole of you?" },
    ],
  },
];
const src = fs.readFileSync(FILE, "utf8");
const data = JSON.parse(src);
const fresh = NEW.filter((p) => !data.paths.some((x) => x.id === p.id));
data.paths.push(...fresh);
fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + "\n");
console.log(`${fresh.length} path(s) added`);
