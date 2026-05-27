import { json } from '@sveltejs/kit';
import { getScoreEventStats } from '$lib/intel/score-logger';

export async function GET() {
	try {
		const stats = await getScoreEventStats();
		return json({
			success: true,
			data: stats
		});
	} catch (error: any) {
		return json({
			success: false,
			error: error.message || 'Failed to retrieve score statistics'
		}, { status: 500 });
	}
}
