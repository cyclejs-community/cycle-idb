for folder in `ls examples`; do
	echo "Building $folder..."
	cd examples/$folder
	if [ $1 = "link" ]; then
		npm link cycle-idb ../../
	fi
	npm run browserify
	cd ../../
done

cd examples
python -m SimpleHTTPServer 8001