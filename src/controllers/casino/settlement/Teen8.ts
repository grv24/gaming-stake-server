export function settleTeen8Result(resultData: any): string[] {
  const winners = new Set<string>();

  // --- 1. Direct winners from win field ---
  if (resultData.win) {
    resultData.win.split(",").forEach((sid: string) => {
      winners.add(sid.trim());
    });
  }

  // --- 2. From sid field (sometimes includes |0 etc) ---
  if (resultData.sid) {
    const parts = resultData.sid.split("|");
    if (parts[0]) {
      parts[0].split(",").forEach((sid: string) => {
        winners.add(sid.trim());
      });
    }
  }

  // --- 3. Parse newdesc ---
  if (resultData.newdesc) {
    const parts = resultData.newdesc.split("#");

    // (a) Pairs like "1 : Pair | 3 : Pair | 8 : Pair"
    if (parts[1]) {
      parts[1].split("|").forEach((cond: string) => {
        const [player, hand] = cond.split(":").map(s => s.trim());
        if (hand && hand.toLowerCase() === "pair") {
          // "Pair plus X" is sid = 8 + playerNum
          const sid = (8 + parseInt(player, 10)).toString();
          winners.add(sid);
        }
      });
    }

    // (b) Totals like "1 : 18 | 2 : 19 | ..."
    if (parts[2]) {
      parts[2].split("|").forEach((cond: string) => {
        const [player, total] = cond.split(":").map(s => s.trim());
        if (player && total) {
          // "Total X" is sid = 16 + playerNum
          const sid = (16 + parseInt(player, 10)).toString();
          winners.add(sid);
        }
      });
    }
  }

  // --- 4. Specials (25–28) from cards ---
  if (resultData.cards) {
    const cards = resultData.cards.split(",").map((c: string) => c.trim());

    // Helper: rank & suit
    const ranks = cards.map((c: string | any[]) => c.slice(0, -2));
    const suits = cards.map((c: string | any[]) => c.slice(-2));

    // Any Colour (25) → at least two same suit in first 2 cards of a player
    // (Assuming 3 cards per player: 8 players = 24 cards, rest dealer)
    let anyColour = false;
    for (let i = 0; i < 24; i += 3) {
      if (suits[i] === suits[i + 1] || suits[i + 1] === suits[i + 2] || suits[i] === suits[i + 2]) {
        anyColour = true;
        break;
      }
    }
    if (anyColour) winners.add("25");

    // Any Straight (26)
    const rankOrder = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
    const rankIndex = (r: string) => rankOrder.indexOf(r.replace("1","10").toUpperCase().replace("DD","").replace("HH","").replace("SS","").replace("CC",""));
    
    const isStraight = (triplet: string[]) => {
      const vals = triplet.map(r => rankIndex(r.slice(0, -2))).sort((a, b) => a - b);
      return vals[2] - vals[0] === 2 && new Set(vals).size === 3;
    };

    let anyStraight = false;
    for (let i = 0; i < 24; i += 3) {
      if (isStraight(cards.slice(i, i + 3))) {
        anyStraight = true;
        break;
      }
    }
    if (anyStraight) winners.add("26");

    // Any Trio (27)
    let anyTrio = false;
    for (let i = 0; i < 24; i += 3) {
      if (ranks[i] === ranks[i + 1] && ranks[i] === ranks[i + 2]) {
        anyTrio = true;
        break;
      }
    }
    if (anyTrio) winners.add("27");

    // Any Straight Flush (28)
    let anySF = false;
    for (let i = 0; i < 24; i += 3) {
      const hand = cards.slice(i, i + 3);
      if (isStraight(hand) && suits[i] === suits[i + 1] && suits[i] === suits[i + 2]) {
        anySF = true;
        break;
      }
    }
    if (anySF) winners.add("28");
  }

  return Array.from(winners);
}
