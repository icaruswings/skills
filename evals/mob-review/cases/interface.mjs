import { fixture, finding, history } from './support.mjs';

const staff = ['Staff engineer', 'balanced'];
const product = ['Product', 'balanced'];
const accessibility = ['Frontend & accessibility', 'economy'];
const repair = 'cda1859a000fdf5e915db3b5622af38a84b24cac';

export default [
  fixture({
    id: 'C13', lenses: [accessibility, product],
    spec: 'The Save control must be reachable by Tab and activate with Enter and Space, as well as a pointer click.',
    context: 'The renderer creates the declared tag and copies tabIndex, role and handlers. It supplies native button keyboard behavior but no keyboard behavior for div. Forms are absent on this screen.',
    before: `function control(save) { return {tag:'button',type:'button',text:'Save',onClick:save}; }`,
    after: `function control(save) { return {tag:'div',role:'button',tabIndex:0,text:'Save',onClick:save}; }`,
    expected: [finding('E13', 'Frontend & accessibility', 'A focusable div with a button role does not gain native Enter or Space activation; replacing the button without a key handler breaks keyboard saving.')],
    probe: `() => {
      let calls=0; const node=control(()=>calls++);
      const focusable=node.tag==='button' || node.tabIndex>=0;
      for (const key of ['Enter',' ']) {
        if(node.onKeyDown) node.onKeyDown({key});
        else if(node.tag==='button') node.onClick();
      }
      node.onClick();
      return {pass:focusable && calls===3, observed:{focusable,activations:calls}};
    }`,
  }),
  fixture({
    id: 'C14', lenses: [accessibility, staff],
    spec: 'Closing the dialog with Escape must restore focus to the same control that opened it.',
    context: 'open is called with the currently focused trigger. The renderer unmounts the dialog when state.open is false. trigger.focus() is the available way to restore focus.',
    before: `function open(trigger) { return {open:true,trigger}; }
function onKey(state,event) {
  if(event.key!=='Escape') return;
  state.open=false; state.trigger.focus();
}`,
    after: `function open(trigger) { return {open:true,trigger}; }
function onKey(state,event) {
  if(event.key!=='Escape') return;
  state.open=false;
}`,
    expected: [finding('E14', 'Frontend & accessibility', 'The Escape close path unmounts the dialog without restoring focus to its opener, so keyboard users lose their place in the screen.')],
    probe: `() => {
      let focus='dialog'; const state=open({focus(){focus='opener';}});
      onKey(state,{key:'Escape'});
      return {pass:state.open===false && focus==='opener', observed:{open:state.open,focus}};
    }`,
  }),
  fixture({
    id: 'C15', lenses: [['Product', 'economy']],
    spec: 'The monthly checkout button must display "Start 7-day trial" and disclose "Then $12/month" before checkout.',
    context: 'This is the monthly plan, charged after seven days. action.text and action.note are rendered together before the user submits. The annual plan is a separate screen.',
    before: `function action() { return {text:'Start 7-day trial', note:'Then $12/month'}; }`,
    after: `function action() { return {text:'Start 7-day trial', note:'Then $12/year'}; }`,
    expected: [finding('E15', 'Product', 'The monthly checkout promises a yearly $12 charge despite the specified monthly billing cadence; correct the visible price interval before users agree to purchase.')],
    probe: `() => {
      const view=action();
      return {pass:view.text==='Start 7-day trial' && view.note==='Then $12/month', observed:view};
    }`,
  }),
  fixture({
    id: 'C16', lenses: [accessibility, staff],
    spec: 'Submitting the form calls save once and prevents browser navigation. Clicking the primary button and pressing Enter in an input must both submit.',
    context: 'The renderer maps form.onSubmit to the native submit event. Native buttons with omitted type default to submit. The form has exactly one primary button and no other submit handlers.',
    before: `function form(save) {
  return {onSubmit:event=>{event.preventDefault();save();}, button:{tag:'button',type:'submit',text:'Save'}};
}`,
    after: `function form(save) {
  return {onSubmit:event=>{event.preventDefault();save();}, button:{tag:'button',text:'Save'}};
}`,
    probe: `() => {
      let saves=0, prevented=0; const view=form(()=>saves++);
      const submit=()=>view.onSubmit({preventDefault(){prevented++;}});
      if((view.button.type ?? 'submit')==='submit') submit();
      submit();
      return {pass:saves===2 && prevented===2, observed:{saves,prevented,button:view.button}};
    }`,
  }),
  fixture({
    id: 'C17', lenses: [product, ['Frontend & accessibility', 'balanced'], ['Operability', 'balanced']],
    spec: 'After a failed load, show an error with a usable Retry control. Retrying must issue another load and clear the error on success.',
    context: 'load calls its supplied callback once. Retry is disabled whenever state.loading is true. The parent owns state and keeps it after a failed request.',
    before: `function refresh(state,load) {
  state.loading=true;
  load((error,items)=>{
    state.loading=false;
    if(error) {state.error=error.message;return;}
    state.error=null;state.items=items;
  });
}`,
    after: `function refresh(state,load) {
  state.loading=true;
  load((error,items)=>{
    if(error) {state.error=error.message;return;}
    state.loading=false;state.error=null;state.items=items;
  });
}`,
    expected: [finding('E17', 'Frontend & accessibility', 'The error branch returns before clearing loading, leaving the Retry control disabled and preventing recovery from a failed load.')],
    probe: `() => {
      const state={loading:false,error:null,items:[]}; let calls=0;
      const load=done=>{calls++; calls===1 ? done(Error('offline')) : done(null,['item']);};
      refresh(state,load); const retryEnabled=!state.loading;
      if(retryEnabled) refresh(state,load);
      return {pass:retryEnabled && calls===2 && state.error===null && state.items[0]==='item', observed:{retryEnabled,calls,state}};
    }`,
  }),
  fixture({
    id: 'C18', lenses: [staff, product],
    spec: 'Archive must act on the row selected by the user, including when the list is filtered or reordered after selection.',
    context: 'select stores selection in parent state. Filter and sort replace rows but preserve selection. Every row has an immutable unique id; archive is the persistence callback.',
    before: `function select(rows,index) { return rows[index].id; }
function archiveSelected(rows,selection,archive) { archive(selection); }`,
    after: `function select(rows,index) { return index; }
function archiveSelected(rows,selection,archive) { archive(rows[selection].id); }`,
    expected: [finding('E18', 'Product', 'Storing a selected row index instead of its stable identity causes archive to target a different row after filtering or sorting changes the list order.')],
    probe: `() => {
      const rows=[{id:'a'},{id:'b'},{id:'c'}]; const selection=select(rows,1);
      const filtered=rows.filter(row=>row.id!=='a'); const archived=[];
      archiveSelected(filtered,selection,id=>archived.push(id));
      return {pass:archived.join()==='b', observed:{selection,filtered,archived}};
    }`,
  }),
  fixture({
    id: 'C19', lenses: [product, staff],
    spec: 'A zero delivery quote means free delivery and must allow checkout. Only null means delivery is unavailable.',
    context: 'quote returns either null or a nonnegative integer number of cents. The UI disables Continue unless available is true, and uses the returned cents in its order summary.',
    before: `function delivery(quote) {
  const cents=quote();
  return {available:cents!==null,cents};
}`,
    after: `function delivery(quote) {
  const cents=quote();
  return {available:Boolean(cents),cents};
}`,
    expected: [finding('E19', 'Product', 'Using truthiness treats the valid zero-cent quote as unavailable, blocking checkout for orders eligible for free delivery.')],
    probe: `() => {
      const free=delivery(()=>0), paid=delivery(()=>500), unavailable=delivery(()=>null);
      return {pass:free.available && free.cents===0 && paid.available && !unavailable.available, observed:{free,paid,unavailable}};
    }`,
  }),
  fixture({
    id: 'C20', lenses: [product, staff],
    spec: 'Show the basket subtotal as whole-dollar text with two decimal places. This view displays a USD subtotal and does not calculate tax or delivery.',
    context: 'items have integer quantity >= 1 and integer unitCents >= 0. Basket values stay below 100000000 cents. Tax and delivery are displayed separately at the next step.',
    before: `function subtotal(items) {
  let cents=0; for(const item of items) cents+=item.unitCents*item.quantity;
  return '$'+(cents/100).toFixed(2);
}`,
    after: `function subtotal(items) {
  const cents=items.reduce((sum,item)=>sum+item.unitCents*item.quantity,0);
  return '$'+(cents/100).toFixed(2);
}`,
    probe: `() => {
      const empty=subtotal([]), mixed=subtotal([{unitCents:125,quantity:3},{unitCents:0,quantity:2},{unitCents:99,quantity:1}]);
      return {pass:empty==='$0.00' && mixed==='$4.74', observed:{empty,mixed}};
    }`,
  }),
  fixture({
    id: 'C21', lenses: [['Infrastructure', 'strong'], ['Staff engineer', 'strong']],
    spec: 'Prune stale managed links only. A managed link has matching names: /installed/<name> points exactly to /repo/skills/<name>. Preserve aliases and links to files within a skill.',
    context: 'entries is a map of installation names to absolute link targets. live lists currently installed managed names. prune returns the names it would remove; the caller unlinks each returned entry.',
    before: `function prune(entries,live) {
  return Object.entries(entries).filter(([name,target]) =>
    !live.includes(name) && target==='/repo/skills/'+name
  ).map(([name])=>name);
}`,
    after: `function prune(entries,live) {
  return Object.entries(entries).filter(([name,target]) =>
    !live.includes(name) && target.startsWith('/repo/skills/')
  ).map(([name])=>name);
}`,
    provenance: history(repair, 'Reintroduces broad stale-link ownership from scripts/link-skills.sh before this repair. Shell path checks become pure string checks on absolute normalized paths; returned removal names replace actual unlink operations.'),
    expected: [finding('E21', 'Infrastructure', 'Treating every link into the source tree as managed also prunes user-created aliases and links to files; ownership requires the entry name to match the direct skill target.')],
    probe: `() => {
      const removed=prune({old:'/repo/skills/old',shortcut:'/repo/skills/current',guide:'/repo/skills/current/README.md',current:'/repo/skills/current'},['current']);
      return {pass:removed.join()==='old', observed:{removed}};
    }`,
  }),
  fixture({
    id: 'C22', lenses: [['Security', 'strong'], ['Data & contracts', 'strong']],
    spec: 'Approve human-only configuration only when the loader will disable implicit invocation. The loader requires a boolean false value.',
    context: 'parseYaml returns a string for a quoted YAML scalar and a boolean for a bare boolean. The loader treats every value other than boolean false as allowing implicit invocation.',
    before: `function validate(config) { return config.policy?.allow_implicit_invocation===false; }`,
    after: `function validate(config) { return String(config.policy?.allow_implicit_invocation)==='false'; }`,
    provenance: history(repair, 'Reintroduces acceptance of quoted false documented in the checker repair. YAML has already been parsed into typed JavaScript values, isolating loss of scalar type without bundling a YAML parser or actual tool configuration.'),
    expected: [finding('E22', 'Security', 'Converting the policy value to a string accepts quoted false, although the loader requires boolean false and would still allow implicit invocation.')],
    probe: `() => {
      const quoted={policy:{allow_implicit_invocation:'false'}};
      const bare={policy:{allow_implicit_invocation:false}};
      const accepted=validate(quoted), legitimate=validate(bare);
      return {pass:!accepted && legitimate, observed:{accepted,legitimate,loaderAllows:quoted.policy.allow_implicit_invocation!==false}};
    }`,
  }),
  fixture({
    id: 'C23', lenses: [['Staff engineer', 'strong'], ['Frontend & accessibility', 'strong'], product],
    spec: 'The search screen must display results for the most recently entered query. Older in-flight responses may arrive after newer ones.',
    context: 'The input handler calls search for every query. fetchResults calls its callback exactly once and does not guarantee callback order. state is shared across calls.',
    before: `function search(state,query,fetchResults) {
  const request=++state.request;
  fetchResults(query,items=>{
    if(request!==state.request) return;
    state.items=items;
  });
}`,
    after: `function search(state,query,fetchResults) {
  ++state.request;
  fetchResults(query,items=>{state.items=items;});
}`,
    expected: [finding('E23', 'Staff engineer', 'An older response can overwrite the latest query results because the request identity guard was removed; retain ordering protection or cancel obsolete requests.')],
    probe: `() => {
      const pending={}; const fetchResults=(query,done)=>{pending[query]=done;};
      const state={request:0,items:[]};
      search(state,'a',fetchResults); search(state,'ab',fetchResults);
      pending.ab(['ab-result']); pending.a(['a-result']);
      return {pass:state.items.join()==='ab-result', observed:state};
    }`,
  }),
  fixture({
    id: 'C24', lenses: [['Infrastructure', 'balanced'], staff],
    spec: 'Report whether a resolved destination lies at or beneath the source root. Sibling paths that merely share the root prefix are allowed.',
    context: 'The caller resolves symlinks before calling inside. Inputs are absolute POSIX paths, have no trailing slash, and have no dot segments. The root is always /repo.',
    before: `function inside(path) { return path==='/repo' || path.startsWith('/repo/'); }`,
    after: `function inside(path) {
  const parts=path.split('/');
  return parts[1]==='repo';
}`,
    probe: `() => {
      const paths=['/repo','/repo/skills','/repository','/repo-copy','/other/repo'];
      const results=paths.map(inside);
      return {pass:JSON.stringify(results)==='[true,true,false,false,false]', observed:{paths,results}};
    }`,
  }),
];
