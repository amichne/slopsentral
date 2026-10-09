#!/bin/sh
# A small effect adapter, not a production publisher. See shell-proof-example.md
# for the supported filesystem/process model and interruption limits.
set -u
LC_ALL=C
export LC_ALL
umask 077
workspace_state=ABSENT
stage=INPUT
outcome='{"type":"INPUT_REJECTED","reason":"ARGUMENT_COUNT"}'
result_status=1

finish() {
    trap - HUP INT TERM
    case "$workspace_state" in
        ABSENT) ;;
        CREATED)
            if rm -rf -- "$workspace" 2>/dev/null; then
                :
            else
                cleanup_status=$?
                outcome="{\"type\":\"CLEANUP_FAILED\",\"outcome\":$outcome,\"exit_status\":$cleanup_status}"
                result_status=1
            fi
            ;;
    esac
    if printf '%s\n' "$outcome"; then
        exit "$result_status"
    else
        # RESULT_EMISSION_FAILED: no reliable structured delivery is possible.
        # The completed effects still happened; a caller must retain uncertainty
        # about publication and cleanup rather than infer rollback from status.
        exit 74
    fi
}

stage_failed() {
    case "$1" in
        126|127) outcome="{\"type\":\"TOOL_UNAVAILABLE\",\"stage\":\"$stage\"}" ;;
        *) outcome="{\"type\":\"STAGE_FAILED\",\"stage\":\"$stage\",\"exit_status\":$1}" ;;
    esac
    finish
}

interrupted() {
    case "$stage" in
        PREPARE) outcome="{\"type\":\"PREPARATION_INTERRUPTED\",\"signal\":\"$1\"}" ;;
        PUBLISH) outcome="{\"type\":\"PUBLICATION_INTERRUPTED\",\"signal\":\"$1\"}" ;;
        *) outcome="{\"type\":\"INTERRUPTED\",\"stage\":\"$stage\",\"signal\":\"$1\"}" ;;
    esac
    result_status=1
    finish
}
trap 'interrupted HUP' HUP
trap 'interrupted INT' INT
trap 'interrupted TERM' TERM

[ "$#" -eq 3 ] || finish
source_path=$1
expected=$2
destination=$3
if [ -z "$source_path" ] || [ -z "$destination" ]; then
    outcome='{"type":"INPUT_REJECTED","reason":"EMPTY_PATH"}'
    finish
fi
case "$expected" in
    *[!0-9a-f]*|'') outcome='{"type":"INPUT_REJECTED","reason":"DIGEST_SHAPE"}'; finish ;;
esac
if [ "${#expected}" -ne 64 ]; then
    outcome='{"type":"INPUT_REJECTED","reason":"DIGEST_SHAPE"}'
    finish
fi

stage=PREPARE
workspace_prefix="${TMPDIR:-/tmp}/artifact-proof."
case "$workspace_prefix" in
    /*) ;;
    *) outcome='{"type":"PROTOCOL_FAILED","stage":"PREPARE"}'; finish ;;
esac
if workspace=$(mktemp -d "${workspace_prefix}XXXXXXXX" 2>/dev/null); then
    suffix=${workspace#"$workspace_prefix"}
    case "$suffix" in
        *[!a-zA-Z0-9]*|'') outcome='{"type":"PROTOCOL_FAILED","stage":"PREPARE"}'; finish ;;
    esac
    if [ "${#suffix}" -ne 8 ] || [ "$workspace" != "$workspace_prefix$suffix" ] ||
        [ ! -d "$workspace" ] || [ -L "$workspace" ]; then
        outcome='{"type":"PROTOCOL_FAILED","stage":"PREPARE"}'
        finish
    fi
    workspace_state=CREATED
else
    stage_failed "$?"
fi

stage=COPY
if cp -- "$source_path" "$workspace/content" 2>/dev/null; then :; else stage_failed "$?"; fi
if [ ! -s "$workspace/content" ]; then
    outcome='{"type":"INPUT_REJECTED","reason":"EMPTY_CONTENT"}'
    finish
fi
stage=FREEZE
if chmod 400 "$workspace/content" 2>/dev/null; then :; else stage_failed "$?"; fi

stage=HASH
if reply=$(shasum -a 256 < "$workspace/content" 2>/dev/null); then :; else stage_failed "$?"; fi
observed=${reply%% *}
case "$observed" in
    *[!0-9a-f]*|'') outcome='{"type":"PROTOCOL_FAILED","stage":"HASH"}'; finish ;;
esac
if [ "${#observed}" -ne 64 ] || [ "$reply" != "$observed  -" ]; then
    outcome='{"type":"PROTOCOL_FAILED","stage":"HASH"}'
    finish
fi
if [ "$observed" != "$expected" ]; then
    outcome="{\"type\":\"CHECKSUM_MISMATCH\",\"expected\":\"$expected\",\"observed\":\"$observed\"}"
    finish
fi

stage=PUBLISH
# linkSync creates the exact destination exclusively, including when the
# destination already names a directory. A hard link publishes the verified
# inode; there is no second read from the mutable source pathname.
if node --input-type=module -e '
import { linkSync } from "node:fs";
try { linkSync(process.argv[1], process.argv[2]); }
catch (failure) {
    const known = ["EEXIST", "EACCES", "EPERM", "ENOENT", "ENOTDIR", "EISDIR",
        "EROFS", "EXDEV", "EMLINK", "ENOSPC", "EDQUOT", "ENAMETOOLONG", "ELOOP"];
    process.exit(known.includes(failure.code) ? 73 : 70);
}
' "$workspace/content" "$destination" 2>/dev/null; then
    outcome="{\"type\":\"PUBLISHED\",\"sha256\":\"$observed\"}"
    result_status=0
else
    publish_status=$?
    case "$publish_status" in
        73|126|127) stage_failed "$publish_status" ;;
        *) outcome="{\"type\":\"PUBLICATION_UNCONFIRMED\",\"exit_status\":$publish_status}"; finish ;;
    esac
fi
finish
