import xs from 'xstream'


export default function CursorSelector(result$) {
	return category => {
		result$.filter(result => result.category === category)
			.map
	}
}