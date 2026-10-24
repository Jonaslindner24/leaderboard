const path = require('path');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS players(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS races(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS results(
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  place INTEGER, points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(race_id, player_id));`);

const MAX_PLAYERS = 12, RESERVED = ['admin', 'api', 'assets'];
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const slugify = n => n.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = v => (v === '' || v == null || isNaN(+v)) ? null : Math.round(+v);

exports.bySlug = slug => db.prepare('SELECT * FROM players WHERE slug=?').get(slug);

exports.addPlayer = raw => {
  const name = String(raw || '').trim().slice(0, 24), slug = slugify(name);
  if (!slug || RESERVED.includes(slug)) throw fail('Invalid name');
  if (db.prepare('SELECT COUNT(*) c FROM players').get().c >= MAX_PLAYERS) throw fail('Maximum of 12 players');
  if (db.prepare('SELECT 1 FROM players WHERE slug=? OR name=?').get(slug, name)) throw fail('Name already exists', 409);
  db.prepare('INSERT INTO players(name,slug) VALUES(?,?)').run(name, slug);
};
exports.delPlayer = id => db.prepare('DELETE FROM players WHERE id=?').run(id);

exports.addRace = raw => {
  const name = String(raw || '').trim().slice(0, 40);
  if (!name) throw fail('Name is missing');
  db.prepare('INSERT INTO races(name) VALUES(?)').run(name);
};
exports.renameRace = (id, raw) => {
  const name = String(raw || '').trim().slice(0, 40);
  if (!name) throw fail('Name is missing');
  db.prepare('UPDATE races SET name=? WHERE id=?').run(name, id);
};
exports.delRace = id => db.prepare('DELETE FROM races WHERE id=?').run(id);

exports.results = raceId => db.prepare('SELECT player_id playerId, place, points FROM results WHERE race_id=?').all(raceId);
exports.setResults = db.transaction((raceId, list) => {
  if (!db.prepare('SELECT 1 FROM races WHERE id=?').get(raceId)) throw fail('Race not found', 404);
  db.prepare('DELETE FROM results WHERE race_id=?').run(raceId);
  const ins = db.prepare('INSERT OR REPLACE INTO results(race_id,player_id,place,points) VALUES(?,?,?,?)');
  for (const r of list || []) {
    const place = num(r.place), points = num(r.points);
    if (place == null && points == null) continue;
    ins.run(raceId, r.playerId, place, points ?? 0);
  }
});

exports.state = () => {
  const players = db.prepare('SELECT * FROM players').all();
  const races = db.prepare('SELECT * FROM races ORDER BY id').all();
  const res = db.prepare('SELECT * FROM results').all();
  const rows = players.map(p => {
    const mine = res.filter(r => r.player_id === p.id);
    const history = races.flatMap(r => {
      const x = mine.find(m => m.race_id === r.id);
      return x ? [{ raceId: r.id, raceName: r.name, place: x.place, points: x.points }] : [];
    });
    return { id: p.id, name: p.name, slug: p.slug, history, total: mine.reduce((s, m) => s + m.points, 0) };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  rows.forEach((p, i) => { p.rank = i && p.total === rows[i - 1].total ? rows[i - 1].rank : i + 1; });
  const done = new Set(res.map(r => r.race_id));
  return { players: rows, races: races.map(r => ({ id: r.id, name: r.name, done: done.has(r.id) })) };
};
