// Word lists for the username finder's Word, Two words, and word_word styles.
// Adjectives and colors read naturally as the first word in a pair ("SilentFox").
const WORDS = {
  adjectives: `swift silent brave bold calm cool dark bright lucky happy wild fuzzy frosty sunny stormy mighty tiny giant
    epic rapid sly witty clever cosmic electric golden mystic noble royal sneaky spicy sweet salty sleepy lazy zesty jolly
    gentle fierce rustic ancient frozen blazing hidden lost lone lunar solar stellar neon retro turbo hyper ultra mega super
    prime pure rare odd quiet loud vivid humble grand eager fancy fluffy glossy groovy hazy icy jumpy keen lucid merry misty
    nifty nimble peppy plucky quick quirky rowdy rusty shiny snappy snowy sparky speedy steady stoic sturdy tidy toasty tricky
    vast velvet wavy windy wise zany atomic arctic astral breezy bubbly chilly cloudy cozy crispy dizzy dusty fiery flashy
    fresh gloomy grumpy hollow jazzy lively magic mellow minty moody murky noisy polar proud radiant secret serene sharp silky
    smoky soft spooky starry stealthy strange tangy timid twisted urban valiant wintry wonky zippy agile bouncy cheeky chunky
    crafty daring dreamy gleaming hasty hungry mini molten phantom primal rogue sacred shady sonic spry stout sunlit thorny wired`,
  animals: `fox wolf bear hawk falcon eagle raven owl panda tiger lion lynx otter badger beaver bunny rabbit koala sloth gecko
    lizard cobra viper python turtle shark whale dolphin orca seal penguin puffin parrot finch sparrow robin crow swan goose
    duck moose elk deer stag bison rhino hippo zebra giraffe camel llama alpaca yak goat lamb pony horse mustang cat kitten
    puppy hound husky corgi pug beagle ferret hamster mouse bat frog toad newt axolotl crab lobster shrimp squid octopus moth
    beetle wasp bee hornet mantis spider ant cricket firefly gopher mole weasel hare coyote jackal hyena panther jaguar cougar
    ocelot leopard cheetah ibis heron crane pelican stork kiwi emu dodo`,
  nature: `river forest leaf maple oak pine cedar willow birch fern moss ivy lotus orchid rose lily daisy tulip poppy clover
    thorn petal bloom blossom seed sprout root branch grove meadow valley canyon ridge cliff summit peak mountain hill dune
    desert oasis island lagoon reef shore coast tide wave ocean lake pond creek brook stream rain storm thunder breeze wind
    gale frost snow glacier hail mist fog cloud sky dawn dusk sunset ember flame blaze ash stone pebble rock boulder crystal
    amber jade pearl coral sand aurora rainbow spring summer autumn winter`,
  space: `star nova comet meteor orbit galaxy cosmos nebula quasar pulsar planet moon luna sol astro rocket shuttle probe
    satellite eclipse zenith horizon void vortex mars venus saturn jupiter pluto titan orion vega sirius apollo gemini lyra
    cygnus draco photon proton neutron atom ion plasma gravity warp portal rover lander crater starlight stardust sunbeam moonbeam`,
  fantasy: `dragon wyvern phoenix griffin unicorn pegasus hydra kraken giant golem troll goblin elf dwarf fairy pixie sprite
    nymph siren mermaid wizard witch mage sorcerer warlock druid shaman knight paladin ranger rogue ninja samurai ronin viking
    pirate bandit outlaw hunter archer warrior guardian sentinel warden hero legend myth fable saga quest rune relic amulet
    talisman crown throne castle tower dungeon realm kingdom empire spell charm potion elixir scroll tome blade sword dagger
    axe hammer shield bow arrow spear lance staff wand orb ghost spirit wraith specter shade oracle prophet sage monk yeti ogre`,
  gaming: `pixel byte bit glitch lag noob pro gamer player boss loot level combo streak clutch sniper tank healer spawn
    respawn checkpoint speedrun arcade console joystick cursor click code script logic data cyber tech robot droid mech
    android cyborg laser blaster jet drone radar sonar signal pulse circuit chip core kernel matrix vector vertex server
    ping frame shader render crash bug patch update beta alpha omega delta sigma`,
  food: `apple mango peach cherry berry lemon lime melon grape plum banana coconut papaya guava apricot fig olive pepper chili
    ginger garlic onion potato tomato carrot pickle waffle pancake donut cookie muffin cupcake brownie pudding candy toffee
    caramel fudge cocoa mocha latte espresso cream butter honey syrup jam toast bagel pretzel nacho taco burrito pizza pasta
    noodle ramen sushi dumpling bun biscuit cracker cheese bacon nugget popcorn sprinkle sundae gelato sorbet mochi boba`,
  colors: `red blue green violet purple orange yellow pink teal cyan azure indigo crimson scarlet ruby amber gold silver
    bronze copper ivory ebony onyx jade emerald sapphire cobalt navy aqua mint lilac lavender magenta coral blush maroon
    rust sepia tan beige slate steel gray charcoal black white`,
};
for (const k in WORDS) WORDS[k] = [...new Set(WORDS[k].trim().split(/\s+/))];

if (typeof module === 'object') module.exports = {WORDS};
