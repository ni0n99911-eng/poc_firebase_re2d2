import { json } from "@sveltejs/kit";
import { Packer, Paragraph, AlignmentType, HeadingLevel, PageBreak, Document } from "docx";
function createHandbookDocx(content) {
  const sections = [];
  sections.push(
    new Paragraph({
      text: "Employee Handbook",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { line: 360, lineRule: "auto" }
    }),
    new Paragraph({
      text: content.businessName,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: `${content.city}, ${content.state}`,
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "",
      spacing: { line: 480 }
    }),
    new Paragraph({
      text: `Generated: ${new Date(content.generatedAt).toLocaleDateString()}`,
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 }
    }),
    new PageBreak()
  );
  sections.push(
    new Paragraph({
      text: "Table of Contents",
      heading: HeadingLevel.HEADING_1,
      spacing: { line: 360, lineRule: "auto" }
    }),
    new Paragraph({
      text: "",
      spacing: { line: 240 }
    })
  );
  for (const sectionId in content.sections) {
    const sectionTitle = content.sections[sectionId] && typeof content.sections[sectionId] === "string" ? sectionId.replace(/-/g, " ").toUpperCase() : sectionId;
    sections.push(
      new Paragraph({
        text: sectionTitle,
        spacing: { line: 240 },
        indent: { left: 360 }
      })
    );
  }
  sections.push(new PageBreak());
  for (const [sectionId, sectionContent] of Object.entries(content.sections)) {
    sections.push(
      new Paragraph({
        text: sectionId.replace(/-/g, " ").toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        spacing: { line: 360, lineRule: "auto" }
      }),
      new Paragraph({
        text: "",
        spacing: { line: 240 }
      })
    );
    if (typeof sectionContent === "string") {
      const paragraphs = sectionContent.split("\n\n");
      for (const para of paragraphs) {
        if (para.trim()) {
          if (para.trim().startsWith("•") || para.trim().startsWith("-")) {
            const bulletPoints = para.split("\n").filter((p) => p.trim());
            for (const bullet of bulletPoints) {
              sections.push(
                new Paragraph({
                  text: bullet.trim().replace(/^[•\-]\s*/, ""),
                  bullet: { level: 0 },
                  spacing: { line: 240 }
                })
              );
            }
          } else {
            sections.push(
              new Paragraph({
                text: para.trim(),
                spacing: { line: 240 }
              })
            );
          }
        }
      }
    }
    sections.push(new PageBreak());
  }
  sections.push(
    new Paragraph({
      text: "Employee Acknowledgment",
      heading: HeadingLevel.HEADING_1,
      spacing: { line: 360, lineRule: "auto" }
    }),
    new Paragraph({
      text: "",
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "I acknowledge that I have received, read, and understood this Employee Handbook. I understand the policies and procedures outlined herein and agree to comply with them.",
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "",
      spacing: { line: 480 }
    }),
    new Paragraph({
      text: "Employee Name (Print):" + " ".repeat(40),
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "_".repeat(80),
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "",
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "Employee Signature:" + " ".repeat(45),
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "_".repeat(80),
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "",
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "Date:" + " ".repeat(75),
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "_".repeat(80),
      spacing: { line: 240 }
    })
  );
  return new Document({
    sections: [
      {
        properties: {},
        children: sections
      }
    ]
  });
}
function createSOPDocx(content) {
  const sections = [];
  sections.push(
    new Paragraph({
      text: "Standard Operating Procedures",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { line: 360, lineRule: "auto" }
    }),
    new Paragraph({
      text: content.businessName,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: `${content.city}, ${content.state}`,
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: "",
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: `Total SOPs: ${content.totalSOPs}`,
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 }
    }),
    new Paragraph({
      text: `Generated: ${new Date(content.generatedAt).toLocaleDateString()}`,
      alignment: AlignmentType.CENTER,
      spacing: { line: 240 }
    }),
    new PageBreak()
  );
  sections.push(
    new Paragraph({
      text: "Table of Contents",
      heading: HeadingLevel.HEADING_1,
      spacing: { line: 360, lineRule: "auto" }
    }),
    new Paragraph({
      text: "",
      spacing: { line: 240 }
    })
  );
  const byCategory = /* @__PURE__ */ new Map();
  for (const sop of content.sops) {
    if (!byCategory.has(sop.category)) {
      byCategory.set(sop.category, []);
    }
    byCategory.get(sop.category).push(sop);
  }
  for (const [category, sops] of byCategory) {
    sections.push(
      new Paragraph({
        text: category,
        spacing: { line: 240 },
        indent: { left: 0 }
      })
    );
    for (const sop of sops) {
      sections.push(
        new Paragraph({
          text: sop.title,
          spacing: { line: 200 },
          indent: { left: 360 }
        })
      );
    }
  }
  sections.push(new PageBreak());
  for (const [category, sops] of byCategory) {
    sections.push(
      new Paragraph({
        text: category,
        heading: HeadingLevel.HEADING_1,
        spacing: { line: 360, lineRule: "auto" }
      }),
      new Paragraph({
        text: "",
        spacing: { line: 240 }
      })
    );
    for (const sop of sops) {
      sections.push(
        new Paragraph({
          text: sop.title,
          heading: HeadingLevel.HEADING_2,
          spacing: { line: 280 }
        }),
        new Paragraph({
          text: `Frequency: ${sop.frequency} | Responsible: ${sop.responsibleRole}`,
          spacing: { line: 240 },
          italics: true
        }),
        new Paragraph({
          text: "",
          spacing: { line: 240 }
        })
      );
      const stepLines = sop.detailedSteps.split("\n").filter((s) => s.trim());
      for (const line of stepLines) {
        const trimmed = line.trim();
        if (trimmed) {
          if (/^\d+\./.test(trimmed)) {
            sections.push(
              new Paragraph({
                text: trimmed.replace(/^\d+\.\s*/, ""),
                bullet: { level: 0 },
                spacing: { line: 240 }
              })
            );
          } else if (/^[•\-]/.test(trimmed)) {
            sections.push(
              new Paragraph({
                text: trimmed.replace(/^[•\-]\s*/, ""),
                bullet: { level: 0 },
                spacing: { line: 240 }
              })
            );
          } else {
            sections.push(
              new Paragraph({
                text: trimmed,
                spacing: { line: 240 }
              })
            );
          }
        }
      }
      sections.push(
        new Paragraph({
          text: "",
          spacing: { line: 240 }
        })
      );
    }
    sections.push(new PageBreak());
  }
  return new Document({
    sections: [
      {
        properties: {},
        children: sections
      }
    ]
  });
}
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.type || !["handbook", "sop"].includes(body.type)) {
      return json(
        { success: false, error: "Missing or invalid 'type' field" },
        { status: 400 }
      );
    }
    if (!body.content || !body.businessName) {
      return json(
        { success: false, error: "Missing required fields: content, businessName" },
        { status: 400 }
      );
    }
    let doc;
    if (body.type === "handbook") {
      doc = createHandbookDocx(body.content);
    } else {
      doc = createSOPDocx(body.content);
    }
    const buffer = await Packer.toBuffer(doc);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${body.businessName.replace(/\s+/g, "_")}_${body.type === "handbook" ? "handbook" : "sop_manual"}.docx"`,
        "Content-Length": buffer.length.toString()
      }
    });
  } catch (error) {
    console.error("Error in export-operations:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
};
export {
  POST
};
