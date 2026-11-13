/**
 * Words and original clues for Mini Crossword. Plain, common words only;
 * every clue is written for this site. Format: "word|clue", one per line.
 */
const RAW = `
ace|Card that can count as one or eleven
act|Part of a play
add|Find the sum
age|Number of candles on a cake
aid|Help, or first ___
aim|Point at a target
air|What we breathe
ale|Pub drink
ant|Small worker in a colony
ape|Large primate
arc|Part of a circle
arm|Limb with an elbow
art|Paintings and sculpture
ash|What is left after a fire
ate|Had dinner
awe|Wonder mixed with respect
bag|Sack for shopping
bat|Night flier, or a cricket tool
bay|Curved part of a coast
bed|Place to sleep
bee|Honey maker
bet|Wager
bib|Baby's mealtime cover
big|Large
bin|Rubbish container
bit|Small piece
bow|Ribbon knot, or a violin's partner
box|Cardboard container
boy|Young lad
bud|Flower before it opens
bug|Small insect, or a software fault
bun|Sweet bread roll
bus|Big vehicle on a route
cab|Taxi you can hail
can|Tin container
cap|Hat with a peak
car|Vehicle with four wheels
cat|Pet that purrs
cow|Animal that gives milk
cry|Shed tears
cub|Young bear or lion
cup|Mug for tea
cut|Slice
dam|Wall across a river
day|Sunrise to sunset
den|Lion's home
dew|Morning drops on grass
dig|Use a spade
dog|Pet that barks
dot|Small round mark
dry|Not wet
due|Owed, or expected
dye|Colour for fabric
ear|Organ of hearing
eat|Have a meal
egg|Hen's product
elf|Little helper in tales
elk|Large deer
end|Finish
era|Long period of history
eve|Night before a holiday
eye|Organ of sight
fan|Supporter, or a cooling device
far|Not near
fig|Sweet fruit with many seeds
fin|Fish's swimming part
fit|In good shape
fix|Repair
fly|Move through the air
fog|Thick mist
fox|Clever red animal
fun|Enjoyment
fur|Animal's soft coat
gap|Opening or space
gas|Neither solid nor liquid
gem|Precious stone
gum|Chewy sweet
gym|Place to work out
hat|Head covering
hay|Dried grass for horses
hen|Female chicken
hip|Joint below the waist
hit|Strike, or a smash song
hog|Pig, or keep it all for yourself
hop|Jump on one foot
hot|Very warm
hug|Warm embrace
hum|Sing with closed lips
hut|Small simple shelter
ice|Frozen water
ink|Pen fluid
inn|Country hotel
ivy|Climbing plant
jam|Fruit spread
jar|Glass container with a lid
jaw|Bone that holds the teeth
jet|Fast plane
jog|Run slowly
joy|Great happiness
key|It opens a lock
kid|Child
kit|Set of tools
lab|Place for experiments
lap|One time around the track
law|Rule of the land
lay|Put down
leg|Limb with a knee
lid|Top of a pot
lip|Edge of the mouth
log|Piece of a tree trunk
low|Not high
map|Guide to the roads
mat|Small rug
mix|Stir together
mop|Floor cleaner on a stick
mud|Wet earth
mug|Big cup
nap|Short sleep
net|Fishing mesh
new|Not old
nod|Say yes with your head
nut|Acorn, for one
oak|Tree that grows acorns
oar|Rowing paddle
oat|Grain for porridge
odd|Not even
oil|Fuel from the ground
old|Not new
orb|Sphere
owl|Night bird that hoots
own|Possess
pad|Notebook, or a cushion
pan|Frying vessel
paw|Animal's foot
pay|Give money for
pea|Small green vegetable
pen|Writing tool
pet|Animal kept at home
pie|Baked dish with a crust
pig|Farm animal that oinks
pin|Small sharp fastener
pit|Stone of a fruit
pod|Pea's case
pot|Cooking vessel
ram|Male sheep
rat|Rodent bigger than a mouse
raw|Not cooked
ray|Beam of light
red|Colour of a ripe tomato
rib|Bone of the chest
rod|Fishing pole
row|Line of seats
rub|Polish by hand
rug|Small carpet
run|Go faster than a walk
rye|Grain for dark bread
sad|Unhappy
sap|Sticky fluid inside a tree
sat|Took a seat
saw|Tool with teeth
sea|Large body of salt water
see|Look at
set|Group of things that belong together
sew|Use a needle and thread
sip|Small drink
sit|Take a seat
sky|Where the clouds are
sly|Cunning
son|Male child
spa|Place for a relaxing soak
spy|Secret agent
sun|Star at the centre of our system
tab|Bill at a bar
tag|Label, or a chasing game
tan|Light brown from the sun
tap|Water outlet
tar|Black road material
tea|Drink brewed from leaves
ten|Number after nine
tie|Neckwear, or a level score
tin|Metal can
tip|Pointed end, or extra money
toe|Digit on a foot
ton|Very heavy weight
top|Highest point
toy|Plaything
tub|Bath, or an ice cream pot
two|Number in a pair
urn|Large vase
use|Make use of
van|Delivery vehicle
vet|Animal doctor
war|Armed conflict
wax|Candle material
web|Spider's home
wet|Soaked
wig|False hair
win|Come first
wit|Clever humour
yak|Shaggy ox of the mountains
yam|Sweet root vegetable
yes|Opposite of no
yet|Up to now
zip|Fastener on a jacket
zoo|Place to see wild animals
able|Capable
acre|Unit of land
aged|Grown old
also|As well
area|Region
arch|Curved doorway
aunt|Parent's sister
bake|Cook in the oven
bald|Without hair
ball|Round toy
band|Group of musicians
bank|Place for money, or a river's edge
barn|Farm building
bead|Small ball on a necklace
beam|Ray of light
bean|Seed in a pod
bear|Large furry animal
bell|It rings
belt|Waist strap
bird|Feathered flier
boat|Small ship
bone|Part of a skeleton
book|Novel, for one
boot|Tall shoe
bowl|Dish for soup
cake|Birthday treat
calm|Peaceful
camp|Stay in a tent
cape|Cloak, or a headland
card|Playing ___
care|Look after
cart|Wheeled wagon
cave|Hollow in a hill
city|Large town
clam|Shellfish
coal|Black fuel
coat|Warm outer garment
code|Secret message system
coin|Small piece of money
cold|Not warm
cone|Ice cream holder
cook|Make meals
cool|Slightly cold
corn|Yellow grain on a cob
crab|Sideways walker of the shore
crew|Ship's workers
crow|Black bird
dart|Small arrow for a board
dawn|Daybreak
deer|Forest animal with antlers
desk|Writing table
dice|Pair of cubes in a game
dish|Plate
dive|Jump into water head first
door|Way in
dove|Bird of peace
drum|Instrument you beat
duck|Water bird that quacks
dune|Sand hill
dust|Fine dirt
east|Where the sun rises
easy|Not hard
echo|Sound that comes back
edge|Border
fair|Just, or a funfair
farm|Place with fields and animals
fast|Quick
fern|Leafy forest plant
film|Movie
fire|Flames
fish|Swimmer with gills
flag|National banner
flat|Level, or an apartment
foal|Young horse
fold|Bend over
food|Meals
foot|End of the leg
fork|Eating tool with prongs
frog|Green jumper of the pond
game|Something you play
gate|Garden door
gift|Present
glue|Sticky paste
goal|Aim, or a score in soccer
gold|Yellow precious metal
golf|Game with clubs and holes
gown|Long dress
grin|Big smile
hail|Ice falling from the sky
hair|It grows on your head
half|One of two equal parts
hand|End of the arm
harp|Stringed instrument for angels
hawk|Bird of prey
heat|Warmth
herb|Basil or thyme
hero|Brave person
hike|Long walk in the hills
hill|Small mountain
hole|Opening
home|Where you live
hood|Head cover on a coat
hook|Bent piece for hanging things
horn|Car's warning sound
hose|Garden water pipe
idea|Thought
iron|Metal, or a tool for clothes
item|Article in a list
jazz|Music style with improvising
jump|Leap into the air
kite|It flies on a string
knee|Leg joint
knot|Tied loop
lake|Body of fresh water
lamb|Young sheep
lamp|Light on a table
lane|Narrow road
leaf|Green part of a tree
lime|Green citrus fruit
lion|King of beasts
list|Shopping ___
loaf|Bread shape
lock|It needs a key
loud|Noisy
mail|Letters and parcels
mask|Face cover
meal|Breakfast or lunch
milk|White drink
mint|Fresh herb
moon|It lights the night sky
moss|Soft green plant on rocks
moth|Night insect drawn to light
nail|Hammer's target
name|What you are called
neck|Head's support
nest|Bird's home
note|Short letter, or a musical sound
oven|Kitchen appliance for baking
page|Side of a sheet in a book
pail|Bucket
palm|Inside of the hand, or a tropical tree
park|Green space in a city
path|Track through a field
pear|Fruit shaped like a bell
pine|Evergreen tree
plum|Purple fruit
pond|Small lake
pool|Place to swim
rain|Water from clouds
rake|Garden tool for leaves
reef|Coral ridge
ring|Band on a finger
road|Street
rock|Stone
roof|Top of a house
rope|Thick cord
rose|Red flower with thorns
sail|Cloth that catches the wind
salt|Seasoning from the sea
sand|Beach material
seed|Start of a plant
ship|Large boat
shoe|Footwear
silk|Smooth fabric from worms
sing|Use your voice musically
sink|Kitchen basin
snow|White winter flakes
soap|Washing bar
sock|Foot cover in a shoe
soup|Hot dish in a bowl
star|Twinkler in the night sky
step|Stair
swan|Graceful white bird
tail|Dog's wagger
tent|Camping shelter
tide|Rise and fall of the sea
tile|Square on a floor
time|What clocks keep
tree|Oak or elm
tuna|Big ocean fish
vase|Flower holder
vest|Sleeveless top
wall|Side of a room
wave|Ocean ripple, or a hand greeting
wind|Moving air
wing|Bird's flying part
wolf|Wild relative of the dog
wood|Timber
wool|Sheep's coat
yard|Garden, or three feet
yarn|Knitting thread
zero|Nothing
about|Concerning
actor|Performer on stage
apple|Fruit that fell on a scientist
arrow|Archer's missile
beach|Sandy shore
berry|Small juicy fruit
blaze|Big fire
board|Plank, or a game's surface
brave|Fearless
bread|Baked loaf
brick|Building block of clay
bunch|Group of grapes
cabin|Small wooden house
camel|Desert animal with humps
candy|Sweets
chair|Seat with a back
chalk|Blackboard writer
chess|Game with kings and pawns
chief|Leader
cloud|White puff in the sky
coast|Seaside
crane|Tall bird, or a building machine
crown|King's headwear
dance|Move to music
daisy|White flower with a yellow centre
dream|Story while you sleep
eagle|Large bird of prey
earth|Our planet
fable|Story with a moral
feast|Big meal
field|Meadow
flame|Tongue of fire
float|Stay on the water
flour|Powder for baking bread
fruit|Apple or pear
ghost|Spooky spirit
giant|Huge person in tales
glass|Window material
grape|Wine fruit
grass|Lawn plant
green|Colour of grass
heart|Organ that pumps blood
honey|Bees' sweet product
horse|Animal you can ride
house|Home with a roof and a door
igloo|Snow house
irons|Some golf clubs
jewel|Gem in a crown
juice|Drink pressed from fruit
knife|Cutting tool
lemon|Sour yellow fruit
light|Not heavy, or not dark
llama|Woolly animal of the Andes
magic|Tricks of a conjuror
maple|Tree with syrup
melon|Big juicy fruit
mouse|Small rodent
music|Songs and tunes
night|Time of darkness
ocean|Atlantic, for one
olive|Small fruit for oil
onion|Vegetable that makes you cry
otter|Playful river animal
paint|Colour for walls
paper|Sheet for writing
peach|Fuzzy fruit
pearl|Gem from an oyster
piano|Instrument with keys
pilot|Plane flier
plant|Living green thing
plate|Dinner dish
queen|Royal lady
quiet|Not loud
radio|It plays stations
river|Flowing water
robin|Bird with a red breast
salad|Bowl of leaves
scale|Weighing device
sheep|Woolly farm animal
shell|Beach find
smile|Happy face
snake|Legless reptile
spoon|Soup tool
stone|Pebble
storm|Thunder and rain
sugar|Sweetener
table|Furniture for meals
tiger|Striped big cat
toast|Browned bread
tower|Tall building
train|Railway vehicle
truck|Big lorry
water|Clear liquid
whale|Biggest sea creature
wheat|Grain for flour
zebra|Striped horse of Africa
anchor|Ship's heavy weight
autumn|Season of falling leaves
basket|Woven container
butter|Spread for toast
candle|Wax light
carrot|Orange root vegetable
castle|Fortified home of a king
cheese|Food made from milk
cherry|Small red fruit with a stone
circle|Round shape
cookie|Sweet biscuit
desert|Dry sandy region
dragon|Fire-breathing beast
forest|Large wood
garden|Plot for flowers
guitar|Six-stringed instrument
island|Land surrounded by water
jungle|Tropical forest
kitten|Young cat
ladder|Climbing frame with rungs
letter|A, B or C
marble|Small glass ball, or a stone
meadow|Grassy field
mirror|Reflecting glass
monkey|Tree-swinging primate
orange|Fruit and colour
parrot|Talking bird
pencil|Writing tool with lead
pepper|Spice, or a vegetable
planet|Mars, for one
potato|Root vegetable for chips
puzzle|Brain teaser
rabbit|Long-eared hopper
rocket|Space vehicle
silver|Shiny grey metal
spider|Eight-legged spinner
summer|Hottest season
tomato|Red salad fruit
turtle|Shelled reptile
violin|Stringed instrument with a bow
window|Glass opening in a wall
winter|Coldest season
`;

export interface ClueWord {
  word: string;
  clue: string;
}

export const CLUES: readonly ClueWord[] = RAW.trim()
  .split('\n')
  .map((line) => {
    const [word, clue] = line.split('|');
    return { word: word!.trim(), clue: clue!.trim() };
  });

export const CLUE_INDEX: ReadonlyMap<string, string> = new Map(CLUES.map((c) => [c.word, c.clue]));
