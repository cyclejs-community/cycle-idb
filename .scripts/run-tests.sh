NODE_PATH=src:src/__test__ node_modules/.bin/tape -r babel-register $1 | node_modules/.bin/tap-diff