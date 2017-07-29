for folder in `ls examples`; do
	echo "Building $folder..."
	cd examples/$folder
	npm link cycle-idb ../../
	npm run browserify
	cd ../../
done

cd examples
python -m SimpleHTTPServer 8001