function drive(actions) {
  let live = true;
  return actions.map(action => {
    if (action === 'stop') {
      live = false;
      return 'stopped';
    }
    return live ? 'accepted' : 'rejected';
  });
}

console.log(JSON.stringify(drive(['request', 'stop', 'request'])));
