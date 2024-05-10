#!/bin/bash

if test -f lines-imported.txt; then
  lines_imported=$(<lines-imported.txt)
else
  lines_imported=0
fi

echo "Previously imported: $lines_imported"
tail -n +"$((lines_imported+1))" web-access.log > new.log
node import.js || exit 1
new_lines_imported=$(wc -l < new.log)
echo "new_lines_imported: $new_lines_imported"
echo "$((lines_imported+new_lines_imported))" > lines-imported.txt
