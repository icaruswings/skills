import { fixture, finding, history } from './support.mjs';

const staff = ['Staff engineer', 'balanced'];
const security = ['Security', 'strong'];
const contracts = ['Data & contracts', 'strong'];
const operations = ['Operability', 'strong'];
const infrastructure = ['Infrastructure', 'strong'];
const repair = 'da2635d527877d7a4e31d09f8403d93a5c4741dd';

export default [
  fixture({
    id: 'C01', lenses: [staff, security],
    spec: 'Return a document only to a session from the document tenant. Request tenant filters are untrusted.',
    context: 'Session identity is verified upstream. find(id) is a global lookup with no tenant scoping; request parameters come directly from the URL.',
    before: `function read(session, request, find) {
  const row = find(request.id);
  return row && row.tenant === session.tenant ? row : null;
}`,
    after: `function read(session, request, find) {
  const row = find(request.id);
  return row && row.tenant === request.tenant ? row : null;
}`,
    expected: [finding('E01', 'Security', 'A caller can supply another tenant in the request and read its row because ownership is compared with untrusted request data instead of the authenticated session.')],
    probe: `() => {
      const row = {id:'r', tenant:'other', text:'private'};
      const foreign = read({tenant:'mine'}, {id:'r',tenant:'other'}, () => row);
      const own = read({tenant:'other'}, {id:'r',tenant:'other'}, () => row);
      return {pass:foreign === null && own === row, observed:{foreign,own}};
    }`,
  }),
  fixture({
    id: 'C02', lenses: [contracts, ['Staff engineer', 'strong']],
    spec: 'Add displayName to the response while supporting installed clients that still read name. All consumers must keep rendering a label.',
    context: 'Mobile releases remain active for 90 days. Legacy code calls payload.name.toUpperCase(); the new web client reads payload.displayName.',
    before: `function response(row) { return {id:row.id, name:row.name, displayName:row.name}; }`,
    after: `function response(row) { return {id:row.id, displayName:row.name}; }`,
    expected: [finding('E02', 'Data & contracts', 'Removing name breaks still-supported installed clients that dereference payload.name; keep the old field until those consumers have migrated.')],
    probe: `() => {
      const payload = response({id:'1',name:'Aster'});
      let legacy; try { legacy = payload.name.toUpperCase(); } catch { legacy = null; }
      return {pass:legacy === 'ASTER' && payload.displayName === 'Aster', observed:{payload,legacy}};
    }`,
  }),
  fixture({
    id: 'C03', lenses: [operations, ['Staff engineer', 'strong']],
    spec: 'A retried delivery of the same event must not create a second charge, including after a worker restarts.',
    context: 'charge(key) is the provider idempotency API: equal keys return the existing charge. A retry uses the same event.id but receives a new attemptId.',
    before: `function deliver(event, attemptId, charge) { return charge(event.id); }`,
    after: `function deliver(event, attemptId, charge) { return charge(attemptId); }`,
    expected: [finding('E03', 'Operability', 'Using the per-attempt ID as the payment idempotency key creates another charge on a retry of the same event; the key must be stable for the logical payment.')],
    probe: `() => {
      const charges = new Map();
      const charge = key => { if (!charges.has(key)) charges.set(key, charges.size+1); return charges.get(key); };
      const first = deliver({id:'order-1'}, 'try-1', charge);
      const retry = deliver({id:'order-1'}, 'try-2', charge);
      return {pass:charges.size === 1 && first === retry, observed:{count:charges.size,first,retry}};
    }`,
  }),
  fixture({
    id: 'C04', lenses: [staff, ['Data & contracts', 'balanced']],
    spec: 'Return a new array sorted by ascending score without modifying the input array.',
    context: 'All scores are finite numbers. Callers retain the input order for another view. Ties must preserve their input order. Runtime is Node 24.',
    before: `function rank(rows) { return rows.slice().sort((a,b) => a.score-b.score); }`,
    after: `function rank(rows) { return rows.toSorted((a,b) => a.score-b.score); }`,
    probe: `() => {
      const rows = [{id:'a',score:2},{id:'b',score:1},{id:'c',score:1}];
      const result = rank(rows);
      return {pass:result !== rows && result.map(x=>x.id).join() === 'b,c,a' && rows.map(x=>x.id).join() === 'a,b,c', observed:{rows,result}};
    }`,
  }),
  fixture({
    id: 'C05', lenses: [['Staff engineer', 'strong'], contracts, operations],
    spec: 'A rejected debit must leave both balances unchanged. Use the supplied transaction boundary so all writes commit together.',
    context: 'db.transaction(callback) writes to an isolated snapshot and commits only if callback returns. db.save writes immediately. save throws for a frozen destination account.',
    before: `function transfer(db, from, to, amount) {
  return db.transaction(tx => {
    tx.save(from, tx.get(from)-amount);
    tx.save(to, tx.get(to)+amount);
  });
}`,
    after: `function transfer(db, from, to, amount) {
  db.save(from, db.get(from)-amount);
  db.save(to, db.get(to)+amount);
}`,
    expected: [finding('E05', 'Data & contracts', 'Removing the transaction permits a source debit to persist when the destination save fails, losing funds instead of rolling back both writes.')],
    probe: `() => {
      let balances = {a:100,b:20};
      const adapter = state => ({get:key=>state[key], save:(key,n)=>{if(key==='b')throw Error('frozen');state[key]=n;}});
      const db = {...adapter(balances), transaction:fn=>{const draft={...balances}; fn(adapter(draft)); balances=draft;}};
      try { transfer(db,'a','b',10); } catch {}
      return {pass:balances.a===100 && balances.b===20, observed:balances};
    }`,
  }),
  fixture({
    id: 'C06', lenses: [infrastructure, security],
    spec: 'The deployment identity may write only object keys under releases/ in the assets bucket.',
    context: 'These statement objects are passed unchanged to a policy evaluator. Its prefix matcher treats a trailing * as matching any suffix; a resource without * matches exactly.',
    before: `function policy() { return {action:'object:Put', resource:'assets/releases/*'}; }`,
    after: `function policy() { return {action:'object:Put', resource:'assets/*'}; }`,
    expected: [finding('E06', 'Security', 'The resource wildcard expands deployment write permission to the whole bucket, allowing overwrite of unrelated objects outside releases/.')],
    probe: `() => {
      const rule = policy();
      const allowed = key => rule.action==='object:Put' && key.startsWith(rule.resource.slice(0,-1));
      const release=allowed('assets/releases/build.js'), other=allowed('assets/customer/logo.png');
      return {pass:release && !other, observed:{rule,release,other}};
    }`,
  }),
  fixture({
    id: 'C07', lenses: [staff, ['Operability', 'balanced']],
    spec: 'For a transient response retry at most three total attempts, then return the last response. Success returns immediately.',
    context: 'The caller passes attempt numbers starting at one. request(attempt) returns a synchronous response with retryable and status fields.',
    before: `function send(request, attempt=1) {
  const result=request(attempt);
  if(result.retryable && attempt<3) return send(request, attempt+1);
  return result;
}`,
    after: `function send(request, attempt=1) {
  const result=request(attempt);
  if(result.retryable && attempt<=3) return send(request, attempt+1);
  return result;
}`,
    expected: [finding('E07', 'Operability', 'The inclusive retry boundary makes four total attempts instead of the specified three, exceeding the retry budget for persistently transient responses.', 'should-fix')],
    probe: `() => {
      const calls=[]; const result=send(n=>{calls.push(n);return {retryable:true,status:503};});
      return {pass:calls.length===3 && result.status===503, observed:{calls,result}};
    }`,
  }),
  fixture({
    id: 'C08', lenses: [security, staff],
    spec: 'Only active members may read records belonging to their tenant. Unauthenticated callers receive null.',
    context: 'Session objects are constructed by trusted middleware. An active member has active === true; tenant IDs are opaque strings. find is a global lookup.',
    before: `function read(session,id,find) {
  if (!session || session.active!==true) return null;
  const row=find(id);
  if (!row || row.tenant!==session.tenant) return null;
  return row;
}`,
    after: `function read(session,id,find) {
  if (session?.active!==true) return null;
  const row=find(id);
  return row?.tenant===session.tenant ? row : null;
}`,
    probe: `() => {
      const row={tenant:'a',id:1}; const find=()=>row;
      const results=[read(null,1,find),read({active:false,tenant:'a'},1,find),read({active:true,tenant:'b'},1,find),read({active:true,tenant:'a'},1,find),read({active:true,tenant:'a'},2,()=>null)];
      return {pass:results[0]===null && results[1]===null && results[2]===null && results[3]===row && results[4]===null, observed:results};
    }`,
  }),
  fixture({
    id: 'C09', lenses: [infrastructure, ['Staff engineer', 'strong']],
    spec: 'Refuse a link destination that resolves anywhere within /repo, before any operation is recorded.',
    context: 'links maps absolute directory aliases to absolute paths. canonical follows the complete chain. The caller writes entries into the physical destination returned by canonical.',
    before: `function canonical(path,links) { while(links[path]) path=links[path]; return path; }
function install(path,links,operations) {
  const resolved=canonical(path,links);
  if(resolved==='/repo' || resolved.startsWith('/repo/')) return false;
  operations.push(canonical(path,links)+'/tool'); return true;
}`,
    after: `function canonical(path,links) { while(links[path]) path=links[path]; return path; }
function install(path,links,operations) {
  const resolved=links[path] || path;
  if(resolved==='/repo' || resolved.startsWith('/repo/')) return false;
  operations.push(canonical(path,links)+'/tool'); return true;
}`,
    provenance: history(repair, 'Reintroduces the multi-hop destination guard regression repaired in scripts/link-skills.sh. Shell readlink and physical path resolution become a bounded alias map; writes become an operation log, with no filesystem mutations.'),
    expected: [finding('E09', 'Infrastructure', 'Checking only the first symlink hop lets an indirect destination resolve into the source repository and records writes there; resolve the full chain before the repository guard.')],
    probe: `() => {
      const ops=[]; const allowed=install('/installed',{'/installed':'/alias','/alias':'/repo/skills'},ops);
      return {pass:allowed===false && ops.length===0, observed:{allowed,ops}};
    }`,
  }),
  fixture({
    id: 'C10', lenses: [infrastructure, ['Staff engineer', 'strong']],
    spec: 'Replace existing links, but preserve real directories and files at installation targets and return false on those conflicts.',
    context: 'fs is an in-memory node map. A directory node may hold user-created content. Assignment replaces the entire node; no caller backup exists.',
    before: `function install(fs,target,source) {
  if(fs[target] && fs[target].kind!=='link') return false;
  fs[target]={kind:'link',to:source}; return true;
}`,
    after: `function install(fs,target,source) {
  delete fs[target];
  fs[target]={kind:'link',to:source}; return true;
}`,
    provenance: history(repair, 'Reintroduces replacement of real per-skill directories from the same linker repair. The original recursive deletion is represented only by deleting a property on a fresh in-memory map; no host files can be removed.'),
    expected: [finding('E10', 'Infrastructure', 'Replacing an existing real directory discards user-owned content; installation must refuse such conflicts and only replace symlinks.')],
    probe: `() => {
      const node={kind:'directory',files:['notes.txt']}; const fs={'/installed/tool':node};
      const allowed=install(fs,'/installed/tool','/repo/skills/tool');
      return {pass:allowed===false && fs['/installed/tool']===node, observed:{allowed,fs}};
    }`,
  }),
  fixture({
    id: 'C11', lenses: [security, contracts],
    spec: 'A human-only tool passes validation only if policy.allow_implicit_invocation is boolean false at the document root.',
    context: 'parseYaml has already produced this object. The tool loader reads only config.policy.allow_implicit_invocation; a missing policy defaults to permitting implicit invocation.',
    before: `function valid(config) { return config.policy?.allow_implicit_invocation===false; }`,
    after: `function valid(config) {
  return Object.values(config).some(section => section?.allow_implicit_invocation===false);
}`,
    provenance: history(repair, 'Reintroduces the invocation-policy location bug repaired in scripts/check-skills.mjs. A parsed object replaces YAML scanning; the loader contract is unchanged so the example isolates checking an ignored parent section.'),
    expected: [finding('E11', 'Security', 'The validator accepts allow_implicit_invocation under an ignored section even though the loader sees no root policy and allows model invocation of a human-only tool.')],
    probe: `() => {
      const misplaced={interface:{allow_implicit_invocation:false}};
      const correct={policy:{allow_implicit_invocation:false}};
      const accepted=valid(misplaced), legitimate=valid(correct);
      return {pass:accepted===false && legitimate===true, observed:{accepted,legitimate,loaderAllows:misplaced.policy?.allow_implicit_invocation!==false}};
    }`,
  }),
  fixture({
    id: 'C12', lenses: [contracts, ['Staff engineer', 'strong']],
    spec: 'Readers must handle legacy title records and newer label records. Introducing label must keep writes readable by consumers of title while the migration remains open.',
    context: 'Existing records always have a nonempty title. Migrated records may have a nonempty label as well. Version-one consumers read title; version-two consumers prefer label.',
    before: `function write(text) { return {title:text}; }
function read(row) { return row.title; }`,
    after: `function write(text) { return {title:text,label:text}; }
function read(row) { return row.label ?? row.title; }`,
    probe: `() => {
      const old={title:'Old'}, next=write('New');
      const labels=[read(old),read(next),next.title];
      return {pass:labels.join('|')==='Old|New|New', observed:{old,next,labels}};
    }`,
  }),
];
