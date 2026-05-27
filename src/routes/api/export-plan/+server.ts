import { json, type RequestHandler } from '@sveltejs/kit';
import { SITE_CONFIG } from '$lib/modules';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
import {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	Table,
	TableRow,
	TableCell,
	WidthType,
	AlignmentType,
	BorderStyle,
	PageBreak,
	Footer,
	PageNumber
} from 'docx';
import type { BusinessPlanData } from '$lib/ai/claude';

export const POST: RequestHandler = async ({ request }) => {
	const limited = rateLimit(request, RATE_LIMITS.export);
	if (limited) return limited;

	try {
		const planData: BusinessPlanData = await request.json();

		// Validate required fields
		if (!planData.title || !planData.executiveSummary) {
			return json({ error: 'Invalid plan data' }, { status: 400 });
		}

		// Create document sections
		const sections = [];

		// Title Page
		sections.push(
			new Paragraph({
				text: 'BUSINESS PLAN',
				heading: HeadingLevel.HEADING_1,
				alignment: AlignmentType.CENTER,
				spacing: { line: 400, lineRule: 'auto', before: 400, after: 200 },
				run: { bold: true, size: 48 }
			}),
			new Paragraph({
				text: planData.title,
				alignment: AlignmentType.CENTER,
				spacing: { line: 400, lineRule: 'auto', before: 200, after: 400 },
				size: 32
			}),
			new Paragraph({
				text: new Date().toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				}),
				alignment: AlignmentType.CENTER,
				spacing: { before: 400, after: 400 }
			}),
			new PageBreak()
		);

		// Table of Contents
		sections.push(
			new Paragraph({
				text: 'TABLE OF CONTENTS',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 0, after: 200 }
			}),
			new Paragraph({
				text: '1. Executive Summary',
				spacing: { before: 100, after: 100 }
			}),
			new Paragraph({
				text: '2. Market Analysis',
				spacing: { before: 100, after: 100 }
			}),
			new Paragraph({
				text: '3. Competitive Landscape',
				spacing: { before: 100, after: 100 }
			}),
			new Paragraph({
				text: '4. Financial Projections',
				spacing: { before: 100, after: 100 }
			}),
			new Paragraph({
				text: '5. Risk Assessment',
				spacing: { before: 100, after: 100 }
			}),
			new Paragraph({
				text: '6. Location Strategy',
				spacing: { before: 100, after: 100 }
			}),
			new Paragraph({
				text: '7. Key Recommendations',
				spacing: { before: 100, after: 400 }
			}),
			new PageBreak()
		);

		// Executive Summary
		sections.push(
			new Paragraph({
				text: '1. EXECUTIVE SUMMARY',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 0, after: 200 }
			}),
			new Paragraph({
				text: planData.executiveSummary,
				spacing: { before: 0, after: 400, line: 360, lineRule: 'auto' }
			})
		);

		// Market Analysis
		sections.push(
			new Paragraph({
				text: '2. MARKET ANALYSIS',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 200 }
			}),
			new Paragraph({
				text: planData.marketAnalysis,
				spacing: { before: 0, after: 400, line: 360, lineRule: 'auto' }
			})
		);

		// Competitive Landscape
		sections.push(
			new Paragraph({
				text: '3. COMPETITIVE LANDSCAPE',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 200 }
			}),
			new Paragraph({
				text: planData.competitiveLandscape,
				spacing: { before: 0, after: 400, line: 360, lineRule: 'auto' }
			})
		);

		// Financial Projections with Table
		sections.push(
			new Paragraph({
				text: '4. FINANCIAL PROJECTIONS',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 200 }
			}),
			new Table({
				width: { size: 100, type: WidthType.PERCENTAGE },
				rows: [
					new TableRow({
						cells: [
							new TableCell({
								children: [
									new Paragraph({
										text: 'Scenario',
										bold: true
									})
								],
								shading: { fill: '4472C4', color: 'FFFFFF' }
							}),
							new TableCell({
								children: [
									new Paragraph({
										text: 'Year 1 Revenue',
										bold: true
									})
								],
								shading: { fill: '4472C4', color: 'FFFFFF' }
							}),
							new TableCell({
								children: [
									new Paragraph({
										text: 'Year 1 Profit',
										bold: true
									})
								],
								shading: { fill: '4472C4', color: 'FFFFFF' }
							}),
							new TableCell({
								children: [
									new Paragraph({
										text: 'Break-Even (Months)',
										bold: true
									})
								],
								shading: { fill: '4472C4', color: 'FFFFFF' }
							})
						]
					}),
					new TableRow({
						cells: [
							new TableCell({
								children: [new Paragraph('Base Case')]
							}),
							new TableCell({
								children: [
									new Paragraph(
										formatCurrency(planData.financialProjections.base.revenue)
									)
								]
							}),
							new TableCell({
								children: [
									new Paragraph(
										formatCurrency(planData.financialProjections.base.profit)
									)
								]
							}),
							new TableCell({
								children: [
									new Paragraph(
										`${planData.financialProjections.base.breakEvenMonths} months`
									)
								]
							})
						]
					}),
					new TableRow({
						cells: [
							new TableCell({
								children: [new Paragraph('Upside')]
							}),
							new TableCell({
								children: [
									new Paragraph(
										formatCurrency(planData.financialProjections.upside.revenue)
									)
								]
							}),
							new TableCell({
								children: [
									new Paragraph(
										formatCurrency(planData.financialProjections.upside.profit)
									)
								]
							}),
							new TableCell({
								children: [
									new Paragraph(
										`${planData.financialProjections.upside.breakEvenMonths} months`
									)
								]
							})
						]
					}),
					new TableRow({
						cells: [
							new TableCell({
								children: [new Paragraph('Downside')]
							}),
							new TableCell({
								children: [
									new Paragraph(
										formatCurrency(planData.financialProjections.downside.revenue)
									)
								]
							}),
							new TableCell({
								children: [
									new Paragraph(
										formatCurrency(planData.financialProjections.downside.profit)
									)
								]
							}),
							new TableCell({
								children: [
									new Paragraph(
										`${planData.financialProjections.downside.breakEvenMonths} months`
									)
								]
							})
						]
					})
				]
			}),
			new Paragraph({
				text: '',
				spacing: { before: 200, after: 400 }
			})
		);

		// Risk Assessment
		sections.push(
			new Paragraph({
				text: '5. RISK ASSESSMENT',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 200 }
			}),
			new Paragraph({
				text: planData.riskAssessment,
				spacing: { before: 0, after: 400, line: 360, lineRule: 'auto' }
			})
		);

		// Location Strategy
		sections.push(
			new Paragraph({
				text: '6. LOCATION STRATEGY',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 200 }
			}),
			new Paragraph({
				text: planData.locationStrategy,
				spacing: { before: 0, after: 400, line: 360, lineRule: 'auto' }
			})
		);

		// Key Recommendations
		sections.push(
			new Paragraph({
				text: '7. KEY RECOMMENDATIONS',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 200 }
			})
		);

		if (planData.recommendations && planData.recommendations.length > 0) {
			planData.recommendations.forEach((rec, index) => {
				sections.push(
					new Paragraph({
						text: rec,
						bullet: { level: 0 },
						spacing: { before: 100, after: 100, line: 360, lineRule: 'auto' }
					})
				);
			});
		}

		// Create document with footer
		const doc = new Document({
			sections: [
				{
					children: sections,
					footers: {
						default: new Footer({
							children: [
								new Table({
									width: { size: 100, type: WidthType.PERCENTAGE },
									rows: [
										new TableRow({
											cells: [
												new TableCell({
													children: [
														new Paragraph({
															text: `Generated by ${SITE_CONFIG.name} — ${SITE_CONFIG.domain}`,
															size: 20,
															color: '888888'
														})
													],
													borders: {
														top: {
															color: '888888',
															space: 1,
															style: BorderStyle.SINGLE,
															size: 6
														},
														bottom: undefined,
														left: undefined,
														right: undefined,
														insideHorizontal: undefined,
														insideVertical: undefined
													}
												}),
												new TableCell({
													children: [
														new Paragraph({
															text: '',
															alignment: AlignmentType.RIGHT
														})
													],
													borders: {
														top: {
															color: '888888',
															space: 1,
															style: BorderStyle.SINGLE,
															size: 6
														},
														bottom: undefined,
														left: undefined,
														right: undefined,
														insideHorizontal: undefined,
														insideVertical: undefined
													}
												})
											]
										}),
										new TableRow({
											cells: [
												new TableCell({
													children: [
														new Paragraph({
															text: '',
															size: 20
														})
													]
												}),
												new TableCell({
													children: [
														new Paragraph({
															text: new PageNumber(),
															alignment: AlignmentType.RIGHT,
															size: 20,
															color: '888888'
														})
													]
												})
											]
										})
									]
								})
							]
						})
					}
				}
			]
		});

		// Generate the document
		const buffer = await Packer.toBuffer(doc);

		// Return as binary response
		return new Response(buffer, {
			headers: {
				'Content-Type':
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'Content-Disposition': `attachment; filename="business-plan-${Date.now()}.docx"`,
				'Content-Length': buffer.length.toString()
			}
		});
	} catch (error) {
		console.error('Error generating DOCX:', error);
		return json(
			{ error: 'Failed to generate DOCX file' },
			{ status: 500 }
		);
	}
};

function formatCurrency(value: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(value);
}
