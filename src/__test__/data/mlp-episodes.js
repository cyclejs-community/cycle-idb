export const mlpEpisodes = {
	friendshipIsMagic_1: { number: 1, title: 'Friendship is Magic, part 1', writer: 'Lauren Faust', season: 1, release_date: '2010-10-10'},
	friendshipIsMagic_2: { number: 2, title: 'Friendship is Magic, part 2', writer: 'Lauren Faust', season: 1, release_date: '2010-10-22'},
	theTicketMaster: { number: 3, title: 'The Ticket Master', writer: 'Amy Keating Rogers & Lauren Faust', season: 1, release_date: '2010-10-29'},
	applebuckSeason: { number: 4, title: 'Applebuck Season', writer: 'Amy Keating Rogers', season: 1, release_date: '2010-11-05'},
	griffonTheBrushOff: { number: 5, title: 'Griffon the Brush Off', writer: 'Cindy Morrow', season: 1, release_date: '2010-11-12'},
	boastBusters: { number: 6, title: 'Boast Busters', writer: 'Chris Savino', season: 1, release_date: '2010-11-19'},
	dragonshy: { number: 7, title: 'Dragonshy', writer: 'Meghan McCarthy', season: 1, release_date: '2010-11-26'},
	lookBeforeYouSleep: { number: 8, title: 'Look Before You Sleep', writer: 'Charlotte Fullerton', season: 1, release_date: '2010-12-03'},
	bridleGossip: { number: 9, title: 'Bridle Gossip', writer: 'Amy Keating Rogers', season: 1, release_date: '2010-12-10'},
	swarmOfTheCentury: { number: 10, title: 'Swarm of the Century', writer: 'M. A. Larson', season: 1, release_date: '2010-12-17'},
	winterWrapUp: { number: 11, title: 'Winter Wrap Up', writer: 'Cindy Morrow', season: 1, release_date: '2010-12-24'},
	callOfTheCutie: { number: 12, title: 'Call of the Cutie', writer: 'Meghan McCarthy', season: 1, release_date: '2011-01-07'},
}

export const mlpEpisodesList = Object.keys(mlpEpisodes).map(x => mlpEpisodes[x])
