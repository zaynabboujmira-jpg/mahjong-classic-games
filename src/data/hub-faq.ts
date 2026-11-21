/**
 * Visible FAQ (and FAQPage JSON-LD) for the hub pages. Answers must stay true
 * to the games on the site: check them when a game or mode changes.
 */
export type FaqItem = { q: string; a: string };

export const HUB_FAQ = {
  solitaire: [
    {
      q: 'What is classic solitaire?',
      a: 'Most people mean Klondike: seven columns, a stock to draw from, and four foundations built from Ace to King in each suit. Spider, FreeCell and Pyramid are other classic solitaire games, and all four are here.',
    },
    {
      q: 'Which solitaire game is easiest?',
      a: 'Spider with 1 suit and Klondike with Draw 1 are the gentlest. FreeCell shows every card face up, so careful players win nearly every deal. Spider with 4 suits is the hardest of the four.',
    },
    {
      q: 'Is Spider harder than Klondike?',
      a: 'It depends on the suits. Spider with 1 suit is usually easier than Klondike, 2 suits is a fair challenge, and 4 suits is much harder than any Klondike deal.',
    },
    {
      q: 'Are these solitaire games free?',
      a: 'Yes. Every solitaire game is free to play online in your browser, on a phone or a computer, with no download and no account.',
    },
  ],
  cards: [
    {
      q: 'Do I need other people to play Hearts, Spades or Cribbage?',
      a: 'No. You play against computer players. In Hearts you face three opponents; in Spades a computer partner sits opposite you against two computer opponents; Cribbage is you against one computer player.',
    },
    {
      q: 'Is Mahjong Solitaire the same as Mahjong?',
      a: 'No. Mahjong Solitaire is a one-player puzzle where you match free pairs of tiles. Mahjong is a four-player game of collecting sets. You can play both here: the puzzle on its own, and the table game against three computer players.',
    },
    {
      q: 'Which card game should I start with?',
      a: 'Klondike if you want a quiet game on your own, Hearts if you want a quick trick-taking game, Spades if you enjoy bidding with a partner, and Cribbage if you like counting points on a pegging board.',
    },
    {
      q: 'Are the card games free?',
      a: 'Yes. Every Mahjong and card game is free to play online, with no download and no account.',
    },
  ],
  board: [
    {
      q: 'Can I play board games against a friend?',
      a: 'Yes. Chess, checkers, Chinese Checkers, backgammon, Four in a Row and Tic Tac Toe all have a 2 player mode for two people on one device. Dominoes is played against 1, 2 or 3 computer players.',
    },
    {
      q: 'How strong is the computer?',
      a: 'Each game has levels from easy to hard, so you can learn the rules first and then look for a challenge. The Unbeatable level of Tic Tac Toe never loses.',
    },
    {
      q: 'Which board game is quickest to learn?',
      a: 'Tic Tac Toe and Four in a Row take a minute to learn. Chinese Checkers, checkers and dominoes follow, then backgammon and chess, which have the most rules to learn.',
    },
    {
      q: 'Are the board games free?',
      a: 'Yes. Every board game is free to play online in your browser, with no download and no account.',
    },
  ],
  puzzles: [
    {
      q: 'Which puzzles have a daily challenge?',
      a: 'Word Guess, Mini Crossword and Word Builder each have a daily puzzle that is the same for everyone. The Daily page also adds a Medium Sudoku, a Klondike deal and a Turtle Mahjong deal.',
    },
    {
      q: 'Will I ever have to guess?',
      a: 'Not in Sudoku or Nonogram: every puzzle has one solution that logic alone can reach. Minesweeper sometimes leaves a true 50-50, which is part of the classic game.',
    },
    {
      q: 'Can I play more than one puzzle a day?',
      a: 'Yes. Every puzzle and word game also has unlimited play alongside its daily puzzle, if it has one.',
    },
    {
      q: 'Are the puzzle games free?',
      a: 'Yes. Every puzzle and word game is free to play online, with no download and no account.',
    },
  ],
  arcade: [
    {
      q: 'Are these the original arcade games?',
      a: 'No. They are original games made for this site in classic arcade styles, such as a maze chase, a space shooter and a brick breaker, with their own names and artwork.',
    },
    {
      q: 'Do the arcade games work on phones?',
      a: 'Yes. Every arcade game has touch controls on phones and tablets, and keyboard controls on a computer.',
    },
    {
      q: 'Are the arcade games free?',
      a: 'Yes. Every arcade game is free to play online, with no download and no account.',
    },
  ],
  games: [
    {
      q: 'What games can I play on Free Play Classic?',
      a: '41 classic browser games in four groups: Mahjong and card games, board games, puzzles and word games, and arcade games.',
    },
    {
      q: 'Do I need an account or a download?',
      a: 'No. Every game plays straight away in your browser, on a phone, tablet or computer.',
    },
    {
      q: 'Can I play offline?',
      a: 'Yes. Once you have visited the site, the games keep working without a connection, so you can play on a plane or in a dead spot.',
    },
  ],
  blog: [
    {
      q: 'Do the guides match the games on this site?',
      a: 'Yes. Every rule in the guides is checked against the games here, so what you read is how the game plays when you try it.',
    },
    {
      q: 'Where should a beginner start?',
      a: 'Pick the guide for the game you play most. The rules guides explain the game from the start, and the strategy guides assume you already know the rules.',
    },
    {
      q: 'Can I practise what a guide teaches?',
      a: 'Yes. Every guide links to its game, and the game is free to play online straight away.',
    },
  ],
} satisfies Record<string, readonly FaqItem[]>;
