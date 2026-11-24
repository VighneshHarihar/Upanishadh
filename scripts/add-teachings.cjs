// One-off curation pass (kept for the record): the central teachings of the Chāndogya and the Bṛhadāraṇyaka, linked to
// the ideas they teach. Each link carries an IAST keyword that the integrity gate checks against the passage, so a
// reference cannot silently point at the wrong mantra. Re-running is harmless: links already present are skipped.
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "data", "curated", "concepts.json");

const ADD = {
  atman: [
    ["BU_1.4.1", "ātmaivedam agra āsīt", "In the beginning this was the Self alone, in the shape of a person; looking round, it saw nothing but itself."],
    ["BU_2.4.5", "ātmanas tu kāmāya", "Not for the husband’s sake is a husband dear, but for the sake of the Self: Yājñavalkya to Maitreyī."],
    ["BU_4.4.22", "mahān aja ātmā", "This great unborn Self, made of consciousness, lies in the space within the heart, ruler of all."],
    ["ChU_8.7.1", "apahatapāpmā", "The Self free from evil, age, death and sorrow, whose desire and resolve are true: that is to be sought."],
    ["ChU_7.25.2", "ātmaivedaṃ sarvam", "The Self is below, above, behind, before: the Self is all this."],
    ["ChU_8.12.1", "martyaṃ vā idaṃ śarīram", "This body is mortal, held by death; it is the seat of the immortal, bodiless Self."],
  ],
  brahman: [
    ["BU_2.3.1", "dve vāva brahmaṇo rūpe", "There are two forms of Brahman: the formed and the formless, the mortal and the immortal."],
    ["ChU_3.14.1", "sarvaṃ khalv idaṃ brahma", "All this is Brahman; from it all arises, in it all rests, into it all dissolves."],
    ["ChU_4.10.5", "prāṇo brahma", "Life is Brahman, joy is Brahman, space is Brahman: the fires teach Upakosala."],
    ["BU_5.1.1", "khaṃ brahma", "That is full, this is full; from the full the full comes forth. Brahman is space."],
  ],
  om: [
    ["ChU_1.1.1", "om ity etad akṣaram", "One should meditate on OM, the syllable, as the Udgītha."],
    ["ChU_2.23.3", "oṃkāreṇa sarvā vāk", "As leaves are held together by a stalk, all speech is held together by OM; OM is all this."],
  ],
  prana: [
    ["ChU_5.1.1", "prāṇo vāva jyeṣṭhaś ca", "Breath is the eldest and the best of the powers."],
    ["ChU_7.15.1", "prāṇo vāva āśāyā bhūyān", "Breath is greater than hope: everything is fixed in it, as spokes in the hub of a wheel."],
  ],
  karma: [
    ["BU_4.4.5", "yathākārī", "As a person acts, as a person behaves, so does he become; by good action one becomes good."],
    ["BU_3.2.13", "puṇyena karmaṇā", "What remains of a person after death? Yājñavalkya and Ārtabhāga speak of action: one becomes good by good action."],
    ["BU_4.4.23", "na karmaṇā vardhate", "The eternal greatness of the knower of Brahman neither grows nor shrinks by action."],
  ],
  punarjanma: [
    ["BU_4.4.3", "tṛṇajalāyukā", "As a caterpillar at the tip of a blade of grass reaches out to the next, the self leaves one body for another."],
    ["BU_4.4.4", "peśaskārī", "As a goldsmith works gold into a newer, finer form, the self makes for itself a newer, finer form."],
    ["ChU_5.10.7", "ramaṇīyacaraṇā", "Those whose conduct here has been pleasant enter a pleasant birth; those of foul conduct, a foul one."],
  ],
  "two-paths": [
    ["ChU_5.10.1", "arciṣam abhisaṃbhavanti", "Those who know the five fires, and practise faith and austerity in the forest, go the way of light."],
    ["BU_6.2.15", "abhisaṃbhavanti", "The same path of the flame, in the Bṛhadāraṇyaka’s telling of the five fires."],
  ],
  moksha: [["BU_4.4.7", "yadā sarve pramucyante", "When all the desires lodged in the heart are let go, the mortal becomes immortal and attains Brahman here."]],
  kama: [
    ["BU_4.4.6", "saktaḥ saha karmaṇaiti", "Attached, one goes with one’s deed to where the mind is set; the one without desire, being Brahman, goes to Brahman."],
    ["BU_4.4.12", "kasya kāmāya", "If a person knows the Self as ‘I am this’, wishing for what, for whose sake, would he suffer along with the body?"],
  ],
  avastha: [
    ["BU_4.3.9", "svapnasthānam", "This person has two places, this world and the next; dream is the third, where the two meet."],
    ["BU_4.3.19", "śyeno vā suparṇo", "As a falcon, tired of flying, folds its wings and comes to rest, so the person hastens to deep sleep."],
    ["ChU_8.11.1", "suptaḥ samastaḥ saṃprasannaḥ", "Asleep, whole and serene, knowing no dream: that is the Self, said Prajāpati."],
  ],
  sakshin: [
    ["BU_3.7.23", "adṛṣṭo draṣṭā", "The unseen seer, the unheard hearer, the unthought thinker: the inner controller."],
    ["BU_4.3.23", "draṣṭur dṛṣṭer viparilopo", "There is no break in the seeing of the seer, for it is imperishable."],
    ["BU_2.4.14", "dvaitam iva", "Where there is a seeming duality one sees another; where all has become the Self, by what could one know the knower?"],
  ],
  abhaya: [["ChU_8.11.1", "amṛtam abhayam", "That is the immortal, the fearless; that is Brahman."]],
  "rta-dharma": [["BU_1.4.14", "dharmāt paraṃ nāsti", "There is nothing higher than dharma; through it the weak prevail over the strong. Dharma is truth."]],
  satya: [
    ["BU_2.3.6", "satyasya satyam", "Its secret name is ‘the truth of truth’: the life-breaths are truth, and it is their truth."],
    ["ChU_4.4.5", "na satyād agā", "You have not swerved from the truth: Gautama accepts Satyakāma for his honest answer."],
  ],
  tapas: [["ChU_2.23.1", "tapa eva dvitīyaḥ", "There are three branches of dharma: sacrifice, study and giving; austerity is the second; the student is the third."]],
  acarya: [
    ["ChU_4.9.3", "ācāryād dhaiva vidyā", "Knowledge learnt from a teacher alone reaches its best."],
    ["ChU_6.14.2", "ācāryavān", "As a man blindfolded is set on the road to Gandhāra, one who has a teacher comes to know."],
  ],
  shraddha: [["ChU_7.19.1", "śraddhā tv eva vijijñāsitavyeti", "When one has faith, one reflects; faith itself must be understood."]],
  ananda: [["BU_4.3.33", "parama ānandaḥ", "The scale of bliss, from the most fortunate of human beings up to the bliss of Brahman."]],
  anna: [["ChU_6.5.1", "annam aśitaṃ tredhā", "Food eaten becomes threefold: the coarsest waste, the middle flesh, the finest mind."]],
  manas: [
    ["ChU_6.5.4", "annamayaṃ hi somya manaḥ", "The mind, my dear, is made of food; breath of water; speech of fire."],
    ["BU_1.5.3", "manasā hy eva paśyati", "It is with the mind that one sees and with the mind that one hears: desire, resolve, doubt, faith, all this is mind."],
  ],
  mrtyu: [["BU_1.2.1", "mṛtyunaivedam āvṛtam", "In the beginning there was nothing here; all this was covered by Death, which is hunger."]],
  amrta: [
    ["BU_1.3.28", "asato mā sad gamaya", "Lead me from the unreal to the real, from darkness to light, from death to immortality."],
    ["BU_2.4.2", "amṛtatvasya", "There is no hope of immortality through wealth, Yājñavalkya tells Maitreyī."],
  ],
  vairagya: [["BU_3.5.1", "vittaiṣaṇāyāś", "Knowing this Self, the wise rise above the desire for sons, for wealth and for worlds, and live as mendicants."]],
  tyaga: [["BU_4.4.22", "pravrājino", "Seeking this world alone, the wandering monks renounce."]],
  svadhyaya: [["ChU_8.15.1", "svādhyāyam", "Having learnt the Veda in the teacher’s house, the householder keeps up his own study in a clean place."]],
  grhastha: [["ChU_8.15.1", "kuṭumbe", "The householder, studying, raising the virtuous, harming no creature, reaches the world of Brahman."]],
  purusha: [
    ["ChU_3.12.6", "sarvā bhūtāni tripād", "Such is its greatness, and the Person is greater still: one quarter of it is all beings, three quarters the immortal in heaven."],
    ["BU_2.5.18", "puraś cakre dvipadaḥ", "He made bodies with two feet and four; the Person entered them all, and dwells in every body."],
  ],
  guha: [
    ["ChU_8.1.1", "daharaṃ puṇḍarīkaṃ", "In this city of Brahman is a small lotus-dwelling, and within it a small space: what is inside it is to be sought."],
    ["ChU_3.14.3", "antarhṛdaye", "This Self of mine within the heart is smaller than a grain of rice, greater than the earth, greater than all these worlds."],
    ["ChU_8.3.3", "hṛdy ayam", "This Self is in the heart: hṛdi ayam, ‘in the heart is this’, hence hṛdayam."],
    ["ChU_3.13.7", "antaḥ puruṣe jyotiḥ", "The light that shines beyond heaven is the very light within the person."],
  ],
  ekatva: [
    ["ChU_6.1.4", "mṛtpiṇḍena", "By one lump of clay all that is made of clay is known: the change is only a name; the clay alone is real."],
    ["BU_4.4.19", "neha nānāsti kiṃ cana", "There is no diversity here at all; who sees diversity goes from death to death."],
  ],
  srshti: [
    ["BU_1.4.3", "dvedhāpātaya", "The Self, alone, found no delight; it wished for a second, and split itself in two."],
    ["BU_1.4.7", "nāmarūpābhyām", "Then this was undifferentiated; it became differentiated by name and form."],
  ],
  avidya: [["BU_4.4.10", "tamaḥ praviśanti", "Into blind darkness enter those who worship ignorance; into a greater darkness those who delight in knowledge alone."]],
  vidya: [["ChU_7.1.3", "tarati śokam", "I know the mantras but not the Self, says Nārada; I have heard that the knower of the Self crosses over sorrow."]],
  bhuman: [["ChU_7.26.2", "na paśyo mṛtyuṃ paśyati", "The one who sees this sees no death, no sickness, no sorrow; seeing, he sees all and attains all."]],
};

const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
let added = 0;
for (const [id, links] of Object.entries(ADD)) {
  const c = data.concepts.find((x) => x.id === id);
  if (!c) throw new Error(`no concept ${id}`);
  for (const [verse, kw, why] of links) {
    if (c.teaches.some((t) => t.verse === verse)) continue;
    c.teaches.push({ verse, kw, why });
    added++;
  }
}
fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + "\n");
console.log(`${added} teaching link(s) added`);
