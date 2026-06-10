import { json } from "@sveltejs/kit";
import { S as SITE_CONFIG } from "../../../../chunks/modules.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
import { Paragraph, AlignmentType, HeadingLevel, PageBreak, Table, TableRow, TableCell, WidthType, Document, Footer, BorderStyle, PageNumber, Packer } from "docx";
const POST = async ({ request }) => {
  const limited = rateLimit(request, RATE_LIMITS.export);
  if (limited) return limited;
  try {
    const planData = await request.json();
    if (!planData.title || !planData.executiveSummary) {
      return json({ error: "Invalid plan data" }, { status: 400 });
    }
    const sections = [];
    sections.push(
      new Paragraph({
        text: "BUSINESS PLAN",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { line: 400, lineRule: "auto", before: 400, after: 200 },
        run: { bold: true, size: 48 }
      }),
      new Paragraph({
        text: planData.title,
        alignment: AlignmentType.CENTER,
        spacing: { line: 400, lineRule: "auto", before: 200, after: 400 },
        size: 32
      }),
      new Paragraph({
        text: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        }),
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 }
      }),
      new PageBreak()
    );
    sections.push(
      new Paragraph({
        text: "TABLE OF CONTENTS",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 0, after: 200 }
      }),
      new Paragraph({
        text: "1. Executive Summary",
        spacing: { before: 100, after: 100 }
      }),
      new Paragraph({
        text: "2. Market Analysis",
        spacing: { before: 100, after: 100 }
      }),
      new Paragraph({
        text: "3. Competitive Landscape",
        spacing: { before: 100, after: 100 }
      }),
      new Paragraph({
        text: "4. Financial Projections",
        spacing: { before: 100, after: 100 }
      }),
      new Paragraph({
        text: "5. Risk Assessment",
        spacing: { before: 100, after: 100 }
      }),
      new Paragraph({
        text: "6. Location Strategy",
        spacing: { before: 100, after: 100 }
      }),
      new Paragraph({
        text: "7. Key Recommendations",
        spacing: { before: 100, after: 400 }
      }),
      new PageBreak()
    );
    sections.push(
      new Paragraph({
        text: "1. EXECUTIVE SUMMARY",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 0, after: 200 }
      }),
      new Paragraph({
        text: planData.executiveSummary,
        spacing: { before: 0, after: 400, line: 360, lineRule: "auto" }
      })
    );
    sections.push(
      new Paragraph({
        text: "2. MARKET ANALYSIS",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 }
      }),
      new Paragraph({
        text: planData.marketAnalysis,
        spacing: { before: 0, after: 400, line: 360, lineRule: "auto" }
      })
    );
    sections.push(
      new Paragraph({
        text: "3. COMPETITIVE LANDSCAPE",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 }
      }),
      new Paragraph({
        text: planData.competitiveLandscape,
        spacing: { before: 0, after: 400, line: 360, lineRule: "auto" }
      })
    );
    sections.push(
      new Paragraph({
        text: "4. FINANCIAL PROJECTIONS",
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
                    text: "Scenario",
                    bold: true
                  })
                ],
                shading: { fill: "4472C4", color: "FFFFFF" }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    text: "Year 1 Revenue",
                    bold: true
                  })
                ],
                shading: { fill: "4472C4", color: "FFFFFF" }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    text: "Year 1 Profit",
                    bold: true
                  })
                ],
                shading: { fill: "4472C4", color: "FFFFFF" }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    text: "Break-Even (Months)",
                    bold: true
                  })
                ],
                shading: { fill: "4472C4", color: "FFFFFF" }
              })
            ]
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph("Base Case")]
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
                children: [new Paragraph("Upside")]
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
                children: [new Paragraph("Downside")]
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
        text: "",
        spacing: { before: 200, after: 400 }
      })
    );
    sections.push(
      new Paragraph({
        text: "5. RISK ASSESSMENT",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 }
      }),
      new Paragraph({
        text: planData.riskAssessment,
        spacing: { before: 0, after: 400, line: 360, lineRule: "auto" }
      })
    );
    sections.push(
      new Paragraph({
        text: "6. LOCATION STRATEGY",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 }
      }),
      new Paragraph({
        text: planData.locationStrategy,
        spacing: { before: 0, after: 400, line: 360, lineRule: "auto" }
      })
    );
    sections.push(
      new Paragraph({
        text: "7. KEY RECOMMENDATIONS",
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
            spacing: { before: 100, after: 100, line: 360, lineRule: "auto" }
          })
        );
      });
    }
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
                              color: "888888"
                            })
                          ],
                          borders: {
                            top: {
                              color: "888888",
                              space: 1,
                              style: BorderStyle.SINGLE,
                              size: 6
                            },
                            bottom: void 0,
                            left: void 0,
                            right: void 0,
                            insideHorizontal: void 0,
                            insideVertical: void 0
                          }
                        }),
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: "",
                              alignment: AlignmentType.RIGHT
                            })
                          ],
                          borders: {
                            top: {
                              color: "888888",
                              space: 1,
                              style: BorderStyle.SINGLE,
                              size: 6
                            },
                            bottom: void 0,
                            left: void 0,
                            right: void 0,
                            insideHorizontal: void 0,
                            insideVertical: void 0
                          }
                        })
                      ]
                    }),
                    new TableRow({
                      cells: [
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: "",
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
                              color: "888888"
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
    const buffer = await Packer.toBuffer(doc);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="business-plan-${Date.now()}.docx"`,
        "Content-Length": buffer.length.toString()
      }
    });
  } catch (error) {
    console.error("Error generating DOCX:", error);
    return json(
      { error: "Failed to generate DOCX file" },
      { status: 500 }
    );
  }
};
function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}
export {
  POST
};
