function settleResultDT20(result, odds = []) {
  if (!result?.data?.success || !Array.isArray(result.data.data)) {
    return [];
  }

  return result.data.data.map(matchResult => {
    const winningSids = [];

    // ✅ 1. Add main winner from `win` field
    if (matchResult.win) {
      winningSids.push(...matchResult.win.split(",").map(s => s.trim()));
    }

    // ✅ 2. Parse newdesc for side bets
    const desc = matchResult.newdesc || "";

    // --- Dragon side bets ---
    if (/D\s*:\s*Even/.test(desc)) {
      const sid = odds.find(o => o.nation.toLowerCase() === "dragon even")?.sid;
      if (sid) winningSids.push(sid);
    }
    if (/D\s*:\s*Odd/.test(desc)) {
      const sid = odds.find(o => o.nation.toLowerCase() === "dragon odd")?.sid;
      if (sid) winningSids.push(sid);
    }
    if (/D\s*:\s*Red/.test(desc)) {
      const sid = odds.find(o => o.nation.toLowerCase() === "dragon red")?.sid;
      if (sid) winningSids.push(sid);
    }
    if (/D\s*:\s*Black/.test(desc)) {
      const sid = odds.find(o => o.nation.toLowerCase() === "dragon black")?.sid;
      if (sid) winningSids.push(sid);
    }
    const dragonCardMatch = desc.match(/D\s*:\s*(\d+)/);
    if (dragonCardMatch) {
      const num = dragonCardMatch[1];
      const sid = odds.find(o => o.nation.toLowerCase() === `dragon card ${num}`.toLowerCase())?.sid;
      if (sid) winningSids.push(sid);
    }

    // --- Tiger side bets ---
    if (/T\s*:\s*Even/.test(desc)) {
      const sid = odds.find(o => o.nation.toLowerCase() === "tiger even")?.sid;
      if (sid) winningSids.push(sid);
    }
    if (/T\s*:\s*Odd/.test(desc)) {
      const sid = odds.find(o => o.nation.toLowerCase() === "tiger odd")?.sid;
      if (sid) winningSids.push(sid);
    }
    if (/T\s*:\s*Red/.test(desc)) {
      const sid = odds.find(o => o.nation.toLowerCase() === "tiger red")?.sid;
      if (sid) winningSids.push(sid);
    }
    if (/T\s*:\s*Black/.test(desc)) {
      const sid = odds.find(o => o.nation.toLowerCase() === "tiger black")?.sid;
      if (sid) winningSids.push(sid);
    }
    const tigerCardMatch = desc.match(/T\s*:\s*(\d+)/);
    if (tigerCardMatch) {
      const num = tigerCardMatch[1];
      const sid = odds.find(o => o.nation.toLowerCase() === `tiger card ${num}`.toLowerCase())?.sid;
      if (sid) winningSids.push(sid);
    }

    return winningSids: [...new Set(winningSids)];
  });
}
