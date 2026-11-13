/**
 * Themed word lists for Word Search. Every word is a plain English word from
 * the public-domain ENABLE word list (a unit test checks the 4-6 letter ones
 * against public/words), with no proper nouns.
 */
export interface Theme {
  id: string;
  name: string;
  words: readonly string[];
}

export const THEMES: readonly Theme[] = [
  {
    id: 'animals',
    name: 'Animals',
    words: ['badger', 'beaver', 'camel', 'cheetah', 'donkey', 'eagle', 'ferret', 'giraffe', 'gorilla', 'hamster', 'hedgehog', 'jaguar', 'koala', 'leopard', 'lizard', 'monkey', 'moose', 'otter', 'panda', 'parrot', 'rabbit', 'raccoon', 'squirrel', 'tiger', 'turtle', 'walrus', 'weasel', 'zebra', 'bison', 'llama'],
  },
  {
    id: 'food',
    name: 'Food',
    words: ['apple', 'bagel', 'banana', 'bread', 'butter', 'carrot', 'cheese', 'cherry', 'cookie', 'grape', 'honey', 'lemon', 'mango', 'muffin', 'noodle', 'olive', 'onion', 'pancake', 'pasta', 'peach', 'pepper', 'pickle', 'potato', 'pretzel', 'salad', 'tomato', 'waffle', 'yogurt', 'melon', 'toast'],
  },
  {
    id: 'nature',
    name: 'Nature',
    words: ['acorn', 'blossom', 'canyon', 'cliff', 'desert', 'forest', 'glacier', 'island', 'jungle', 'lagoon', 'meadow', 'moss', 'mountain', 'pebble', 'prairie', 'river', 'stone', 'stream', 'swamp', 'valley', 'volcano', 'willow', 'canopy', 'fern', 'grove', 'marsh', 'ridge', 'summit', 'thicket', 'boulder'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    words: ['anchor', 'coral', 'crab', 'current', 'dolphin', 'harbor', 'jellyfish', 'kelp', 'lobster', 'octopus', 'oyster', 'pearl', 'reef', 'sailor', 'salmon', 'seagull', 'shark', 'shell', 'shrimp', 'squid', 'starfish', 'surf', 'tide', 'trench', 'tuna', 'walrus', 'whale', 'wave', 'buoy', 'clam'],
  },
  {
    id: 'space',
    name: 'Space',
    words: ['asteroid', 'comet', 'cosmos', 'crater', 'eclipse', 'galaxy', 'gravity', 'meteor', 'moon', 'nebula', 'orbit', 'planet', 'rocket', 'satellite', 'shuttle', 'solar', 'star', 'telescope', 'universe', 'lunar', 'quasar', 'pulsar', 'module', 'capsule', 'stellar', 'zenith', 'astral', 'launch', 'rover', 'probe'],
  },
  {
    id: 'sports',
    name: 'Sports',
    words: ['archery', 'baseball', 'boxing', 'cricket', 'cycling', 'diving', 'fencing', 'football', 'golf', 'hockey', 'karate', 'rowing', 'rugby', 'sailing', 'skating', 'skiing', 'soccer', 'surfing', 'swimming', 'tennis', 'judo', 'polo', 'squash', 'bowling', 'curling', 'racing', 'relay', 'sprint', 'goal', 'medal'],
  },
  {
    id: 'music',
    name: 'Music',
    words: ['banjo', 'bass', 'cello', 'chord', 'chorus', 'drum', 'flute', 'guitar', 'harmony', 'harp', 'lyric', 'melody', 'organ', 'piano', 'rhythm', 'tempo', 'trumpet', 'tuba', 'violin', 'whistle', 'ballad', 'bugle', 'cymbal', 'oboe', 'opera', 'tune', 'verse', 'anthem', 'duet', 'solo'],
  },
  {
    id: 'weather',
    name: 'Weather',
    words: ['breeze', 'cloud', 'drizzle', 'fog', 'frost', 'gale', 'hail', 'humid', 'lightning', 'mist', 'monsoon', 'rain', 'rainbow', 'sleet', 'snow', 'storm', 'sunny', 'thunder', 'tornado', 'typhoon', 'wind', 'blizzard', 'chilly', 'cyclone', 'dew', 'flurry', 'gust', 'haze', 'icicle', 'squall'],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    words: ['blender', 'bowl', 'cup', 'fork', 'grater', 'kettle', 'knife', 'ladle', 'mixer', 'mug', 'oven', 'plate', 'pot', 'skillet', 'spatula', 'spoon', 'stove', 'teapot', 'toaster', 'tongs', 'whisk', 'apron', 'colander', 'jar', 'kitchen', 'napkin', 'pantry', 'sieve', 'sink', 'tray'],
  },
  {
    id: 'garden',
    name: 'Garden',
    words: ['bloom', 'bulb', 'compost', 'daisy', 'fence', 'flower', 'hedge', 'hose', 'lawn', 'lily', 'mulch', 'orchid', 'petal', 'poppy', 'rake', 'rose', 'seed', 'shovel', 'soil', 'sprout', 'stem', 'tulip', 'weed', 'basket', 'bench', 'trowel', 'violet', 'gate', 'path', 'pond'],
  },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0]!;
