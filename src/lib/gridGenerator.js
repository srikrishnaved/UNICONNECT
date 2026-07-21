// Pure JS — no React, no Supabase. Pass pre-fetched DB rows as arguments.

function mulberry32(seed) {
  var s = (seed >>> 0);
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr) {
  return parseInt(dateStr.replace(/-/g, ''), 10);
}

export function normalizeText(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019']/g, '')
    .trim();
}

function seededShuffle(arr, rand) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function buildIndex(players, playerClubs, playerCountries) {
  var byId = {};
  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    byId[p.id] = {
      id: p.id,
      name: p.name,
      clubs: {},
      countries: {},
      normalizedNames: [normalizeText(p.name)].concat(
        (p.aliases || []).map(normalizeText)
      ),
    };
  }
  for (var i = 0; i < playerClubs.length; i++) {
    var pc = playerClubs[i];
    if (byId[pc.player_id]) byId[pc.player_id].clubs[pc.club_name] = true;
  }
  for (var i = 0; i < playerCountries.length; i++) {
    var pc = playerCountries[i];
    if (byId[pc.player_id]) byId[pc.player_id].countries[pc.country_name] = true;
  }
  var result = [];
  var keys = Object.keys(byId);
  for (var i = 0; i < keys.length; i++) result.push(byId[keys[i]]);
  return result;
}

function matchCategory(player, cat) {
  return cat.type === 'club'
    ? !!player.clubs[cat.value]
    : !!player.countries[cat.value];
}

function validPlayersForCell(index, rowCat, colCat) {
  return index.filter(function(p) {
    return matchCategory(p, rowCat) && matchCategory(p, colCat);
  });
}

var FALLBACK = {
  rowCategories: [
    { type: 'club', value: 'Real Madrid' },
    { type: 'club', value: 'Barcelona' },
    { type: 'country', value: 'France' },
  ],
  colCategories: [
    { type: 'country', value: 'Brazil' },
    { type: 'country', value: 'England' },
    { type: 'club', value: 'Chelsea' },
  ],
};

export function generateGrid(dateStr, players, playerClubs, playerCountries, maxRetries) {
  var retries = maxRetries || 50;
  var index = buildIndex(players, playerClubs, playerCountries);

  var clubsSeen = {};
  var clubs = [];
  for (var i = 0; i < playerClubs.length; i++) {
    var cn = playerClubs[i].club_name;
    if (!clubsSeen[cn]) { clubsSeen[cn] = true; clubs.push(cn); }
  }
  var countriesSeen = {};
  var countries = [];
  for (var i = 0; i < playerCountries.length; i++) {
    var cn = playerCountries[i].country_name;
    if (!countriesSeen[cn]) { countriesSeen[cn] = true; countries.push(cn); }
  }

  var pool = [];
  for (var i = 0; i < clubs.length; i++) pool.push({ type: 'club', value: clubs[i] });
  for (var i = 0; i < countries.length; i++) pool.push({ type: 'country', value: countries[i] });

  var rand = mulberry32(dateToSeed(dateStr));

  for (var attempt = 0; attempt < retries; attempt++) {
    var shuffled = seededShuffle(pool, rand);
    var rowCategories = shuffled.slice(0, 3);
    var colCategories = shuffled.slice(3, 6);

    var allSix = rowCategories.concat(colCategories);
    var seen = {};
    for (var i = 0; i < allSix.length; i++) seen[allSix[i].value] = true;
    if (Object.keys(seen).length < 6) continue;

    var clubCount = 0;
    var countryCount = 0;
    for (var i = 0; i < allSix.length; i++) {
      if (allSix[i].type === 'club') clubCount++;
      else countryCount++;
    }
    if (clubCount === 6 || countryCount === 6) continue;

    var valid = true;
    var cells = [];
    for (var ri = 0; ri < 3 && valid; ri++) {
      for (var ci = 0; ci < 3 && valid; ci++) {
        var vp = validPlayersForCell(index, rowCategories[ri], colCategories[ci]);
        if (vp.length < 2) { valid = false; }
        else cells.push(vp);
      }
    }
    if (valid) return { rowCategories: rowCategories, colCategories: colCategories, cells: cells, isFallback: false };
  }

  var rc = FALLBACK.rowCategories;
  var cc = FALLBACK.colCategories;
  var cells = [];
  for (var ri = 0; ri < 3; ri++) {
    for (var ci = 0; ci < 3; ci++) {
      cells.push(validPlayersForCell(index, rc[ri], cc[ci]));
    }
  }
  return { rowCategories: rc, colCategories: cc, cells: cells, isFallback: true };
}

export function checkAnswer(input, validPlayers, usedPlayerIds) {
  var norm = normalizeText(input);
  if (!norm) return { result: 'empty', message: 'Enter a player name.' };

  for (var i = 0; i < validPlayers.length; i++) {
    var player = validPlayers[i];
    var names = player.normalizedNames;
    for (var j = 0; j < names.length; j++) {
      if (names[j] === norm) {
        if (usedPlayerIds.has(player.id)) {
          return { result: 'used', message: player.name + ' already used!' };
        }
        return { result: 'correct', playerId: player.id, playerName: player.name };
      }
    }
  }
  return { result: 'incorrect', message: 'No match — try another player.' };
}
