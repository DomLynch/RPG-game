// Legends (Dom via Strategy, 2026-09-27): every opponent wears a name at each of the ten rungs, taken from a PUBLIC-DOMAIN source —
// myth, folklore, ancient history, pre-1900 books — and never a figure of a living religion (Strategy, 2026-09-27: dead pantheons,
// folklore, story figures and history only; Yama and Azrael were swapped for Ereshkigal and Arawn). The backstory is original prose in the arena's voice: no quotation, and nothing
// from a film, comic, game or other modern retelling. Text only; no fight number reads this.
//
// Noted exception (Dom 2026-09-28): nightborn 7 is Vlad, the historical Vlad III, over the living-nation-hero standard (.claude/skills/legends-rule).
//
// The rung is the FIGHT's level read through the ladder that already exists (grades.ts tierAt over career.ts rankFor), never a second
// mapping: a fight at level L is the rank a fighter with L − 1 wins holds, so a dial-down fight shows the legend of the level it is
// fought at. Cosmetic like grades.ts, so it stays out of the simulation boundary (roster.ts may not import it).
import { MAX_LEVEL } from './career.ts';
import { levelOf, tierAt } from './grades.ts';
import type { OpponentId } from './roster.ts';

export type Legend = { name: string; source: string; backstory: string };
export const LEGEND_OPPONENTS = ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'dwarf', 'shieldmaiden', 'plaguedoctor', 'witch', 'knight'] as const satisfies readonly OpponentId[];
export type LegendOpponent = (typeof LEGEND_OPPONENTS)[number];

const row = (name: string, source: string, backstory: string): Legend => ({ name, source, backstory });

// Index 0 is tier 1 (Recruit), index 9 is tier 10 (Origin).
export const LEGENDS: Record<LegendOpponent, readonly Legend[]> = {
  veteran: [
    row('Crixus', 'Appian, Civil Wars', 'A Gaul sold to Capua\'s schools who broke out beside Spartacus and led his own army till Rome caught it. In Frankendom he fights with nothing to lose.'),
    row('Ragnar Lothbrok', 'Ragnar\'s saga', 'The raider who sailed up the Seine, took Paris and died singing in a pit of snakes. In Frankendom he fights laughing, as if the snakes were waiting.'),
    row('Beowulf', 'Beowulf', 'The Geat who crossed the sea to tear Grendel\'s arm off bare-handed, then went into the mere after the mother. In Frankendom he fights trusting his grip.'),
    row('Spartacus', 'Plutarch, Crassus', 'The Thracian who broke out of Capua with seventy men and beat Rome\'s armies for two years. In Frankendom he fights as the man every slave watches.'),
    row('Miyamoto Musashi', 'Book of Five Rings', 'The ronin who won sixty duels, one with an oar he carved on the boat to the island. In Frankendom he fights arriving late and calm.'),
    row('Hannibal', 'Livy; Polybius', 'The Carthaginian who marched elephants over the Alps and destroyed eight legions at Cannae. In Frankendom he fights as a trap that closes unseen.'),
    row('Leonidas', 'Herodotus, Histories 7', 'The Spartan king who held Thermopylae with a few hundred men till none were left. In Frankendom he fights as if the pass were at his back.'),
    row('Ajax', 'Homer, Iliad', 'The Greek with the tower shield who stood alone over the ships when the line broke, and fought Hector to a draw. In Frankendom he fights as a walking wall.'),
    row('Alexander', 'Plutarch, Moralia 466D', 'The Macedonian who never lost a battle, and wept that of endless worlds he ruled not one. In Frankendom he fights at the head of the charge.'),
    row('Mars', 'Roman myth', 'Father of Romulus and lord of the legions, whose name Rome gave to its field of war. In Frankendom he fights as war itself, owed a tithe of every duel.'),
  ],
  pitborn: [
    row('Pit Thrall', 'generic', 'A nameless brute bought for the pits and kept on scraps between bouts. In Frankendom he fights because he knows nothing else, and hits like a thrown stone.'),
    row('Cacus', 'Roman myth', 'The fire-breathing giant who stole Hercules\' cattle, dragging them into his cave by their tails so the tracks led away. In Frankendom he fights as a thief.'),
    row('Redcap', 'Border folklore', 'The fiend of the old border tales who dyed his cap red in the blood of travellers caught in his ruin. In Frankendom he fights to keep his cap wet.'),
    row('Gogmagog', 'Geoffrey of Monmouth', 'The last giant of Albion, who wrestled the Trojan Corineus on a sea cliff and was thrown down. In Frankendom he fights to win the throw he lost.'),
    row('Grendel', 'Beowulf', 'The fen-walker who raided a king\'s hall by night for twelve winters, hating its song. In Frankendom he fights as a creature of the marsh, furious and unrelenting.'),
    row('Polyphemus', 'Greek myth', 'The one-eyed shepherd giant who penned Odysseus in his cave and lost his eye to a sharpened stake. In Frankendom he fights with a giant\'s anger.'),
    row('Humbaba', 'Epic of Gilgamesh', 'Guardian of the Cedar Forest, whose roar was a flood and whose breath was death, set there by the gods. In Frankendom he fights as the forest\'s wrath.'),
    row('Antaeus', 'Greek myth', 'The wrestler-giant who grew stronger each time he touched the earth, till Hercules held him aloft. In Frankendom he fights low, rising from every fall.'),
    row('Surtr', 'Norse myth', 'The fire giant of Muspelheim, who waits at the edge of the world to set it alight at its end. In Frankendom he fights as the last blaze.'),
    row('Typhon', 'Greek myth', 'The storm-serpent giant with a hundred heads, the deadliest foe Zeus ever faced. In Frankendom he fights as the monster the gods themselves fled.'),
  ],
  goblin: [
    row('Sewer Imp', 'generic', 'A gutter-born scrap of malice that lives on what the drains carry. In Frankendom he fights dirty, fast and low, and runs before anyone can catch him.'),
    row('Kobold', 'German folklore', 'A house and mine spirit who helps when fed and plays cruel tricks when slighted. In Frankendom he fights as a grudge with a knife.'),
    row('Nain Rouge', 'French-Canadian folklore', 'The red dwarf of the Detroit river, whose sighting warned of disaster and who cursed the man who struck him. In Frankendom he fights as ill luck.'),
    row('Andvari', 'Norse myth', 'A dwarf who lived as a pike in a waterfall and cursed the ring Loki stole from him. In Frankendom he fights to make every taker regret it.'),
    row('Alberich', 'Nibelungenlied', 'The dwarf who guarded the Nibelung hoard and wore a cloak that made him unseen, till Siegfried took it. In Frankendom he fights as a keeper of stolen gold.'),
    row('Rumpelstiltskin', 'Grimm', 'The little man who spun straw into gold for a price and lost all when his name was spoken. In Frankendom he fights as a bargain that always comes due.'),
    row('Puck', 'English folklore', 'The hobgoblin who leads night travellers astray and laughs at their falls. In Frankendom he fights as a prank with sharp edges, never where you swing.'),
    row('Reynard the Fox', 'Medieval European fable', 'The red fox of the beast fables, who talks his way out of every noose the king\'s court ties. In Frankendom he fights with a smile and a bite.'),
    row('Hermes', 'Greek myth', 'Messenger of the gods, who stole Apollo\'s cattle on the day he was born and talked his way free. In Frankendom he fights with quick feet and a liar\'s smile.'),
    row('Loki', 'Norse myth', 'The shape-changing trickster of Asgard, both help and ruin to the gods, bound at last until the world ends. In Frankendom he fights as mischief unchained.'),
  ],
  nightborn: [
    row('Night Page', 'generic', 'A pale servant of some darker house, sent out after dusk on errands no one names. In Frankendom he fights quietly, eager to earn his master\'s notice.'),
    row('Lord Ruthven', 'The Vampyre, 1819', 'A cold nobleman who moved through society charming the young and leaving them drained. In Frankendom he fights with courtly manners and patient thirst.'),
    row('Varney', 'Varney the Vampire, 1847', 'Sir Francis Varney, an undead gentleman who hated what he was and fed anyway. In Frankendom he fights long, grim bouts, as if he could not stop.'),
    row('Carmilla', 'Le Fanu, 1872', 'A countess dead for a century, who returned as a lonely girl to feed on the one she loved. In Frankendom she fights with sad eyes and no mercy at all.'),
    row('Erlking', 'German folklore', 'The king of the elves who rides the night woods and takes children from their fathers\' arms. In Frankendom he fights as the cold wind in the trees.'),
    row('Mordred', 'Arthurian legend', 'The traitor knight who seized Arthur\'s throne and met him in the last battle at Camlann. In Frankendom he fights as betrayal with a sword.'),
    row('Vlad', 'Chalkokondyles, Histories', 'Wallachia\'s prince who held the Danube from the Sultan and met him with a forest of stakes. In Frankendom he fights as the terror at the gate.'),
    row('Set', 'Egyptian myth', 'Lord of desert and storm, who slew his brother Osiris and fought Horus for the throne. In Frankendom he fights as chaos in the red sand.'),
    row('Hades', 'Greek myth', 'King of the dead, who rules beneath the earth and lets no soul go home. In Frankendom he fights as the host of the last feast.'),
    row('Nyx', 'Greek myth', 'Night herself, older than the gods, whom even Zeus feared to anger. In Frankendom she fights as the dark that falls on every arena at last.'),
  ],
  executioner: [
    row('Headsman', 'generic', 'A hooded servant of the block who does the work the law will not do with its own hands. In Frankendom he fights as a job to be finished cleanly.'),
    row('Ankou', 'Breton folklore', 'The last man to die each year, who drives a creaking cart to gather the souls of the next. In Frankendom he fights as the one you hear before you see.'),
    row('Charon', 'Greek myth', 'The ferryman of the dead, who poles the river Styx and wants his coin before he takes you over. In Frankendom he fights as the price of crossing.'),
    row('Hel', 'Norse myth', 'Loki\'s daughter, half living and half dead, who rules the dead who fall without glory. In Frankendom she fights as the cold hall no warrior wants.'),
    row('Anubis', 'Egyptian myth', 'The jackal-headed guardian who weighs each heart against a feather. In Frankendom he fights as judgement, and he has already read the scales.'),
    row('Ereshkigal', 'Mesopotamian myth', 'The queen of the land of no return, who stripped her own sister of every jewel at the seven gates. In Frankendom she fights as a gate that takes.'),
    row('The Morrigan', 'Irish myth', 'The war goddess who washes the armour of doomed men at the ford and flies over battle as a crow. In Frankendom she fights as the omen that came true.'),
    row('Arawn', 'Welsh myth', 'The grey-clad king of Annwn, the otherworld, who hunts with white hounds and traded places with a mortal prince for a year. In Frankendom he fights as a hunt.'),
    row('Thanatos', 'Greek myth', 'Death himself, twin of Sleep, with a heart of iron: he lets go of no one he takes, not even kings. In Frankendom he fights without hurry, as he always arrives.'),
    row('The Reaper', 'European folklore', 'The skeleton with the scythe who leads pope, king and beggar in the Dance of Death on old church walls. In Frankendom he fights as the harvest.'),
  ],
  dwarf: [
    row('Forge Hand', 'generic', 'A soot-black apprentice who carries coal and swings the striker\'s hammer for his master. In Frankendom he fights with the arms of a man who never rests.'),
    row('Alvis', 'Norse myth', 'The all-wise dwarf who came for Thor\'s daughter and was kept answering Thor\'s questions till sunrise turned him to stone. In Frankendom he fights the dawn.'),
    row('Regin', 'Volsunga saga', 'The smith who forged Sigurd\'s sword so the boy could slay his dragon brother. In Frankendom he fights as a craftsman with a grudge older than the blade.'),
    row('Brokkr', 'Norse myth', 'The dwarf who bet Loki\'s head his brother could outdo the sons of Ivaldi, and won the gods Thor\'s hammer. In Frankendom he fights to collect the wager.'),
    row('Eitri', 'Norse myth', 'The master smith who forged Mjolnir, a golden boar and a ring that drips eight more. In Frankendom he fights with a maker\'s eye for the weak seam.'),
    row('Wayland', 'Germanic legend', 'The smith lamed by a greedy king, who forged wings and took a terrible revenge. In Frankendom he fights as the craftsman no chain can hold.'),
    row('Kothar-wa-Khasis', 'Canaanite myth', 'The skilled and wise god of craft who built Baal\'s palace and forged the clubs that beat the sea. In Frankendom he fights with tools made for gods.'),
    row('Ptah', 'Egyptian myth', 'The creator god of Memphis, patron of builders, who shaped the world by thought and word. In Frankendom he fights as the first maker.'),
    row('Goibniu', 'Cath Maige Tuired', 'The smith of the Tuatha De Danann who forged spearheads in three blows for the war on the Fomorians. In Frankendom he fights as the forge at full heat.'),
    row('Hephaestus', 'Greek myth', 'The lame smith of Olympus, cast out by his own mother, who forged the armour of heroes. In Frankendom he fights as the god who armed them all.'),
  ],
  shieldmaiden: [
    row('Shield Girl', 'generic', 'A farmer\'s daughter who took up her dead brother\'s shield and never gave it back. In Frankendom she fights stubborn and square behind the boss.'),
    row('Hervor', 'Hervarar saga', 'The shieldmaiden who woke her dead father in his barrow to claim the cursed sword Tyrfing. In Frankendom she fights with a blade the dead would not keep.'),
    row('Camilla', 'Aeneid', 'The swift warrior queen of the Volsci, raised in the wild, who led cavalry against the Trojans. In Frankendom she fights at a run, too fast to pin.'),
    row('Lagertha', 'Saxo Grammaticus', 'A warrior woman who fought beside Ragnar and turned a lost battle with her charge. In Frankendom she fights where the line is breaking.'),
    row('Boudica', 'British history', 'The queen of the Iceni who rose against Rome and burned three of its cities. In Frankendom she fights for vengeance, and she does not bargain.'),
    row('Tomyris', 'Herodotus', 'The Massagetae queen who defeated Cyrus the Great and, the story goes, plunged his head into a skin of blood. In Frankendom she fights as an empire\'s end.'),
    row('Scathach', 'Irish myth', 'The warrior woman of the Isle of Skye who trained Cu Chulainn in every feat of arms. In Frankendom she fights as the teacher of champions.'),
    row('Penthesilea', 'Greek myth', 'The Amazon queen who came to Troy\'s aid and fell to Achilles, who grieved to see her face. In Frankendom she fights as the equal of heroes.'),
    row('Brynhildr', 'Norse myth', 'The valkyrie cast down for choosing her own victor, sleeping in a ring of fire until a hero rode through. In Frankendom she fights as the chooser of the slain.'),
    row('Athena', 'Greek myth', 'Goddess of wisdom and war, born armoured from her father\'s head. In Frankendom she fights as strategy itself, and the aegis turns every blow.'),
  ],
  plaguedoctor: [
    row('Beak', 'generic', 'A masked town physician who walks the plague streets with herbs in his beak and a cane to keep the sick away. In Frankendom he fights at arm\'s length.'),
    row('Paracelsus', '16th-century history', 'The Swiss physician who burned the old medical books in Basel and healed with metals and poisons. In Frankendom he fights as a measure of harm.'),
    row('Locusta', 'Roman history', 'The poisoner of Nero\'s Rome, hired by an empress and an emperor to clear the way to the throne. In Frankendom she fights with a patient, quiet malice.'),
    row('Medea', 'Greek myth', 'The Colchian sorceress who brewed potions for Jason and poisoned a princess with a gown. In Frankendom she fights as betrayal brewed in a pot.'),
    row('Circe', 'The Odyssey', 'The enchantress of Aeaea who turned Odysseus\'s crew into swine with a cup of wine. In Frankendom she fights to make a beast of her foe.'),
    row('Sekhmet', 'Egyptian myth', 'The lioness goddess whose breath was the desert wind and who sent plague on the wicked. In Frankendom she fights as fever with teeth.'),
    row('Nergal', 'Babylonian myth', 'The lord of the underworld who brought plague, war and scorching noon. In Frankendom he fights as the sickness that follows armies.'),
    row('Apollo', 'The Iliad', 'The archer god whose arrows brought plague to the Greek camp at Troy for nine days. In Frankendom he fights as healing and sickness from one hand.'),
    row('Hecate', 'Greek myth', 'The goddess of crossroads, herbs and witchcraft, who walks with torches and hounds. In Frankendom she fights as every poison\'s patron.'),
    row('Resheph', 'Canaanite myth', 'The Canaanite lord of plague and war, whose arrows carried pestilence through the ranks of armies. In Frankendom he fights as sickness loosed from a bow.'),
  ],
  witch: [
    row('Hedge Witch', 'generic', 'A village wise woman who knows which root heals and which one kills. In Frankendom she fights with the same knowledge, and a sharp tongue.'),
    row('Mother Shipton', 'English folklore', 'The cave-born Yorkshire prophetess of the chapbooks, who foretold fires, wars and the fall of great men. In Frankendom she fights as one who saw the end.'),
    row('Grimhild', 'Volsunga saga', 'The queen who brewed a drink of forgetting and turned heroes against their oaths. In Frankendom she fights to make you lose your place.'),
    row('Ceridwen', 'Welsh myth', 'The enchantress whose cauldron brewed a year for three drops of wisdom, then chased the thief through every shape. In Frankendom she fights as a pursuit.'),
    row('Nimue', 'Arthurian legend', 'The Lady of the Lake who learned Merlin\'s secrets and sealed him away with them. In Frankendom she fights as the student who surpassed the master.'),
    row('Louhi', 'Kalevala', 'The mistress of the cold North who stole the sun and moon and fought for the magic mill. In Frankendom she fights as winter with a grudge.'),
    row('Baba Yaga', 'Slavic folklore', 'The witch of the deep forest who lives in a hut on hen\'s legs and flies in a mortar. In Frankendom she fights as the forest\'s oldest threat.'),
    row('Morgan le Fay', 'Arthurian legend', 'The enchantress, half-sister to Arthur, who schemed against his court and carried him to Avalon. In Frankendom she fights as both foe and kin.'),
    row('Merlin', 'Arthurian legend', 'The wizard born of a mortal and a spirit, who raised a king and foresaw his fall. In Frankendom he fights as foresight, a step ahead of every swing.'),
    row('Odin', 'Norse myth', 'The All-Father who gave an eye for wisdom and hung nine nights on the world tree to win the runes. In Frankendom he fights as the price of knowing.'),
  ],
  knight: [
    row('Squire', 'generic', 'A lord\'s boy who polishes the mail and holds the horse, hungry for his own spurs. In Frankendom he fights to prove he is ready for them.'),
    row('Bedivere', 'Arthurian legend', 'The knight who stayed with Arthur to the end and returned the sword to the lake. In Frankendom he fights with a loyal heart.'),
    row('Gawain', 'Arthurian legend', 'The courteous nephew of Arthur who grew stronger as the sun climbed toward noon. In Frankendom he fights best in the heat of the day.'),
    row('Roland', 'Song of Roland', 'The paladin who held the pass at Roncevaux and blew his horn only when all was lost. In Frankendom he fights too proud to call for help.'),
    row('El Cid', 'Spanish epic and history', 'The exiled Castilian lord who took Valencia against every king and, it is told, rode out after death. In Frankendom he fights for no king.'),
    row('Lancelot', 'Arthurian legend', 'The greatest knight of the Round Table, undone by a love his king could not forgive. In Frankendom he fights flawless, and knows it.'),
    row('Siegfried', 'Nibelungenlied', 'The dragon-slayer who bathed in the beast\'s blood and was left with one small bare spot. In Frankendom he fights as though he cannot be hurt, almost.'),
    row('Hector', 'The Iliad', 'The prince of Troy, its best defender, who faced Achilles alone outside the walls. In Frankendom he fights for everyone behind him.'),
    row('Achilles', 'Greek myth', 'The greatest of the Greeks, who chose a short life of glory and was undone only at the heel. In Frankendom he fights as wrath made perfect.'),
    row('Thor', 'Norse myth', 'The thunder god with the hammer Mjolnir, guardian of gods and men against the giants. In Frankendom he fights as the storm that hammers back.'),
  ],
};

// The legend for an opponent at a rung (1..10).
export const legendAt = (id: LegendOpponent, tier: number): Legend => LEGENDS[id][Math.min(10, Math.max(1, Math.floor(tier))) - 1]!;
// The rung (1..10) a fight at `level` (1..46, the dial) is fought at: that level's rank title on the career ladder, the one the HUD reads.
// The one source for "which legend was this": the face, the skull and a kill's Provenance.tier (Lead 2026-09-30: one win, one skull).
export const rungOf = (level: number): number => levelOf(tierAt(level - 1));
// The legend a fight at `level` shows.
export const legendForLevel = (id: LegendOpponent, level: number): Legend => legendAt(id, rungOf(level));
// The highest level (1..46) that reads as a rung, through the same mapping: the Sparring tab's Legend pick fights there (Origin = 46).
export const rungTopLevel = (rung: number): number => Array.from({ length: MAX_LEVEL }, (_, i) => MAX_LEVEL - i).find((level) => rungOf(level) === rung) ?? 1;
// The legend's painted face (Dom via Strategy, 2026-09-28, versus card B4): public/legends/<opponent>-<rung>.webp, the rung legendForLevel reads.
// A missing file is no face: the card keeps today's layout (main.ts).
export const portraitKey = (id: LegendOpponent, level: number): string => `${id}-${rungOf(level)}`;
export const portraitPath = (id: LegendOpponent, level: number): string => `legends/${portraitKey(id, level)}.webp`;
// Every face name, <opponent>-<rung 1..10>: the kill link's `?l=` (share-store shortLink) and the nginx whitelist that turns it into the
// link preview's og:image (deploy/frankendom.com.conf, pinned by tests/legend-og.test.ts). Nothing outside this list reaches the tag.
export const PORTRAIT_KEYS: readonly string[] = LEGEND_OPPONENTS.flatMap((id) => Array.from({ length: 10 }, (_, i) => `${id}-${i + 1}`));
export const isLegendOpponent = (id: string): id is LegendOpponent => (LEGEND_OPPONENTS as readonly string[]).includes(id);
