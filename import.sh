#!/bin/bash

if [[ $# -eq 0 ]] ; then
  echo 'Pass path to web-access.log as argument, for example bash import.sh web-access.log'
  exit 1
fi

if test -f lines-imported.txt; then
  lines_imported=$(<lines-imported.txt)
else
  lines_imported=0
fi

echo "Previously imported: $lines_imported"
tail -n +"$((lines_imported+1))" $1 > new.log || exit 1
node import.js || exit 1
new_lines_imported=$(wc -l < new.log)
echo "new_lines_imported: $new_lines_imported"
echo "$((lines_imported+new_lines_imported))" > lines-imported.txt
