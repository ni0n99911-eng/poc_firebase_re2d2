/**
 * Outcome Check-In System
 *
 * Schedules and sends periodic check-in emails to users who saved
 * a scored location. Three check-ins at 30, 90, and 180 days.
 *
 * Architecture:
 *   1. When user saves a scored location → scheduleCheckIns() inserts 3 rows
 *      into outcome_checkins with future scheduled_for dates.
 *   2. A cron/scheduled task calls processCheckIns() → sends emails for any
 *      rows where scheduled_for <= now() and status = 'pending'.
 *   3. Each email contains a direct link to /app/outcomes?respond=<id>&checkin=N
 *      which loads the outcome submission form pre-filled with location context.
 */

import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { SITE_CONFIG } from '$lib/modules';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────
// Check-in schedule: days after scoring
// ─────────────────────────────────────────────────
const CHECK_IN_SCHEDULE = [
	{ number: 1, daysAfter: 30,  label: '30-day check-in' },
	{ number: 2, daysAfter: 90,  label: '90-day check-in' },
	{ number: 3, daysAfter: 180, label: '6-month check-in' }
];

// ─────────────────────────────────────────────────
// Schedule check-ins for a newly saved location
// ─────────────────────────────────────────────────
export async function scheduleCheckIns(
	supabase: SupabaseClient,
	params: {
		scoredLocationId: string;
		userId: string;
		userEmail: string;
		userName: string;
	}
): Promise<void> {
	const now = new Date();
	const rows = CHECK_IN_SCHEDULE.map(ci => ({
		scored_location_id: params.scoredLocationId,
		user_id: params.userId,
		user_email: params.userEmail,
		user_name: params.userName,
		check_in_number: ci.number,
		scheduled_for: new Date(now.getTime() + ci.daysAfter * 24 * 60 * 60 * 1000).toISOString(),
		status: 'pending'
	}));

	const { error } = await supabase
		.from('outcome_checkins')
		.insert(rows);

	if (error) {
		console.error('[CHECK-IN] Failed to schedule check-ins:', error);
	} else {
		console.log(`[CHECK-IN] Scheduled ${rows.length} check-ins for location ${params.scoredLocationId}`);
	}
}

// ─────────────────────────────────────────────────
// Process pending check-ins (called by cron/scheduler)
// ─────────────────────────────────────────────────
export async function processCheckIns(supabase: SupabaseClient): Promise<{
	sent: number;
	errors: number;
}> {
	const now = new Date().toISOString();

	// Find all pending check-ins that are due
	const { data: pending, error } = await supabase
		.from('outcome_checkins')
		.select(`
			id,
			scored_location_id,
			user_id,
			user_email,
			user_name,
			check_in_number,
			scheduled_for
		`)
		.eq('status', 'pending')
		.lte('scheduled_for', now)
		.order('scheduled_for', { ascending: true })
		.limit(50);

	if (error || !pending?.length) {
		return { sent: 0, errors: error ? 1 : 0 };
	}

	// Fetch associated scored locations for context
	const locationIds = [...new Set(pending.map(p => p.scored_location_id))];
	const { data: locations } = await supabase
		.from('scored_locations')
		.select('id, address, location_iq, grade, business_type, concept_type')
		.in('id', locationIds);

	const locationMap = new Map((locations || []).map(l => [l.id, l]));

	let sent = 0;
	let errors = 0;

	for (const checkin of pending) {
		const location = locationMap.get(checkin.scored_location_id);
		if (!location) {
			// Location was deleted, skip
			await supabase
				.from('outcome_checkins')
				.update({ status: 'skipped' })
				.eq('id', checkin.id);
			continue;
		}

		try {
			const emailId = await sendCheckInEmail({
				to: checkin.user_email,
				name: checkin.user_name || 'there',
				checkInNumber: checkin.check_in_number,
				address: location.address,
				locationIQ: location.location_iq,
				grade: location.grade,
				businessType: location.business_type,
				scoredLocationId: checkin.scored_location_id
			});

			await supabase
				.from('outcome_checkins')
				.update({
					status: 'sent',
					sent_at: new Date().toISOString(),
					email_id: emailId || null
				})
				.eq('id', checkin.id);

			sent++;
		} catch (err) {
			console.error(`[CHECK-IN] Failed to send check-in ${checkin.id}:`, err);
			errors++;
		}
	}

	console.log(`[CHECK-IN] Processed: ${sent} sent, ${errors} errors`);
	return { sent, errors };
}

// ─────────────────────────────────────────────────
// Send a single check-in email
// ─────────────────────────────────────────────────
async function sendCheckInEmail(params: {
	to: string;
	name: string;
	checkInNumber: number;
	address: string;
	locationIQ: number;
	grade: string;
	businessType: string;
	scoredLocationId: string;
}): Promise<string | null> {
	const apiKey = env.RESEND_API_KEY;
	if (!apiKey) {
		console.log(`[CHECK-IN] Email skipped (no API key) for ${params.to}`);
		return null;
	}

	const resend = new Resend(apiKey);
	const from = env.RESEND_FROM_ADDRESS || 'RE² <onboarding@resend.dev>';

	const schedule = CHECK_IN_SCHEDULE.find(c => c.number === params.checkInNumber);
	const label = schedule?.label || `Check-in #${params.checkInNumber}`;

	const respondUrl = `${SITE_CONFIG.url}/app/outcomes?respond=${params.scoredLocationId}&checkin=${params.checkInNumber}`;

	// Grade color
	const gradeColor = params.grade?.startsWith('A') ? '#34d399'
		: params.grade?.startsWith('B') ? '#fbbf24'
		: params.grade?.startsWith('C') ? '#f97316'
		: '#ef4444';

	const { data, error } = await resend.emails.send({
		from,
		to: [params.to],
		subject: `📍 ${label}: How's ${params.address.split(',')[0]} working out?`,
		html: `
			<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
				<div style="background: linear-gradient(135deg, #0a0b10, #12131a); border-radius: 12px; padding: 32px; color: #d4d6e3;">
					<h1 style="color: #00e8cc; margin: 0 0 8px 0; font-size: 22px;">Hey ${params.name}!</h1>
					<p style="color: #8a8d9d; margin: 0 0 24px 0; font-size: 14px;">
						It's been a while since you analyzed a location. We'd love a quick update.
					</p>

					<!-- Location card -->
					<div style="background: rgba(0, 232, 204, 0.06); border: 1px solid rgba(0, 232, 204, 0.15); border-radius: 10px; padding: 20px; margin-bottom: 24px;">
						<div style="font-size: 16px; font-weight: 700; color: #f0f0f5; margin-bottom: 8px;">
							📍 ${params.address}
						</div>
						<div style="display: flex; align-items: center; gap: 16px;">
							<div style="text-align: center;">
								<div style="font-size: 28px; font-weight: 800; color: #00e8cc; font-family: 'DM Mono', monospace;">${params.locationIQ}</div>
								<div style="font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">Score</div>
							</div>
							<div style="text-align: center;">
								<div style="font-size: 28px; font-weight: 800; color: ${gradeColor}; font-family: 'DM Mono', monospace;">${params.grade}</div>
								<div style="font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">Grade</div>
							</div>
							<div style="text-align: center;">
								<div style="font-size: 14px; font-weight: 600; color: #8a8d9d;">${params.businessType}</div>
								<div style="font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">Concept</div>
							</div>
						</div>
					</div>

					<!-- Question -->
					<p style="color: #d4d6e3; font-size: 15px; margin-bottom: 20px;">
						<strong>Quick question:</strong> What happened with this location?
					</p>

					<!-- CTA buttons -->
					<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;">
						<a href="${respondUrl}&verdict=opened" style="display: inline-block; padding: 12px 20px; background: linear-gradient(135deg, #2d5a27, #34d399); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 13px;">
							✅ We opened here
						</a>
						<a href="${respondUrl}&verdict=passed" style="display: inline-block; padding: 12px 20px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 13px;">
							❌ We passed
						</a>
						<a href="${respondUrl}&verdict=still_looking" style="display: inline-block; padding: 12px 20px; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); color: #fbbf24; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 13px;">
							🔍 Still looking
						</a>
					</div>

					<p style="color: #555; font-size: 12px; margin: 0;">
						Your feedback helps RE² learn and improve scores for everyone.
						Takes less than 60 seconds.
					</p>
				</div>
				<p style="color: #444; font-size: 11px; text-align: center; margin-top: 16px;">
					${SITE_CONFIG.name} — ${SITE_CONFIG.tagline} | ${SITE_CONFIG.domain}
				</p>
			</div>
		`
	});

	if (error) {
		console.error('[CHECK-IN] Email send error:', error);
		throw error;
	}

	return data?.id || null;
}
