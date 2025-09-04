function settleResultLucky7(result: { data: { success: any; data: any[]; }; }) {
    if (!result?.data?.success || !Array.isArray(result.data.data)) {
        return [];
    }

    return result.data.data.map(matchResult => {
        const card = matchResult.cards; // e.g. "8HH"
        const value = card.slice(0, -2); // "8"
        const suit = card.slice(-2);     // "HH"

        const winningSids = [];

        // High/Low
        if (["2", "3", "4", "5", "6"].includes(value)) {
            winningSids.push("1"); // Low
        } else {
            winningSids.push("2"); // High
        }

        // Odd/Even
        if (parseInt(value) % 2 === 0) {
            winningSids.push("3"); // Even
        } else {
            winningSids.push("4"); // Odd
        }

        // Color
        if (suit.includes("H") || suit.includes("D")) {
            winningSids.push("5"); // Red
        } else {
            winningSids.push("6"); // Black
        }

        // Exact Card
        const cardMap: { [key: string]: string } = {
            "1": "7",
            "2": "8",
            "3": "9",
            "4": "10",
            "J": "17",
            "Q": "18",
            "K": "19"
        };

        const sidForCard = cardMap[value] || value; // e.g. "8" → sid "14"
        if (sidForCard) winningSids.push(sidForCard);

        // Lines (custom rules, e.g. 1–3 = line1, 4–6 = line2, etc.)
        const lineSids = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12, 13] };
        for (const [sid, line] of Object.entries(lineSids)) {
            if (line.includes(parseInt(value))) winningSids.push((+sid + 19).toString());
        }

        return winningSids;
    });
}
