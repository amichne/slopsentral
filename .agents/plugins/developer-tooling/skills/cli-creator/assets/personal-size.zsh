# Source explicitly to connect the parent session's history to --teach.
personal-size() {
  emulate -L zsh
  if (( ${@[(I)--teach]} )); then
    local recent
    if recent=$(fc -ln -20 2>/dev/null); then
      print -r -- "$recent" | command personal-size "$@" --teach-history-stdin
      return ${pipestatus[2]}
    fi
  fi
  command personal-size "$@"
}
