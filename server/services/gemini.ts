import { GoogleGenAI, Type } from '@google/genai';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface StudentProfileInput {
  name: string;
  education_level: string;
  college: string;
  degree_branch: string;
  graduation_year: string;
  skills: string[];
  languages: string[];
  projects: Array<{ title: string; summary: string; stack: string }>;
  preferred_roles: string[];
}

export interface InternshipInput {
  title: string;
  company_name: string;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  eligibility: string;
}

export interface SkillMatchOutput {
  estimatedMatchPercentage: number;
  matchingSkills: string[];
  missingSkills: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  eligibilityWarnings: string[];
  recommendedResources: Array<{ topic: string; resourceType: string; action: string }>;
  suggestedProjects: Array<{ title: string; scope: string; skillsCovered: string[] }>;
  explanation: string;
  usedAi: boolean;
}

export function computeDeterministicMatch(
  profile: StudentProfileInput,
  internship: InternshipInput
): SkillMatchOutput {
  const studentSet = new Set(
    [...profile.skills, ...profile.languages].map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  const reqSkills = internship.required_skills.length > 0 ? internship.required_skills : [];
  const prefSkills = internship.preferred_skills.length > 0 ? internship.preferred_skills : [];

  const matchingSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const req of reqSkills) {
    const low = req.toLowerCase();
    const matched = Array.from(studentSet).some((st) => st === low || st.includes(low) || low.includes(st));
    if (matched) matchingSkills.push(req);
    else missingSkills.push(req);
  }

  for (const pref of prefSkills) {
    const low = pref.toLowerCase();
    const matched = Array.from(studentSet).some((st) => st === low || st.includes(low) || low.includes(st));
    if (matched && !matchingSkills.includes(pref)) {
      matchingSkills.push(pref);
    }
  }

  const denominator = Math.max(reqSkills.length, 1);
  const reqMatchedCount = reqSkills.filter((r) => matchingSkills.includes(r)).length;
  const prefBonus = prefSkills.filter((p) => matchingSkills.includes(p)).length * 5;
  const pct = Math.min(96, Math.max(15, Math.round((reqMatchedCount / denominator) * 85 + prefBonus)));

  const eligibilityWarnings: string[] = [];
  if (
    internship.eligibility !== 'Not specified' &&
    profile.graduation_year &&
    /\b202[5-9]\b/.test(internship.eligibility) &&
    !internship.eligibility.includes(profile.graduation_year)
  ) {
    eligibilityWarnings.push(
      `Listing eligibility mentions specific graduation window (${internship.eligibility}); verify your ${profile.graduation_year} graduation year qualifies.`
    );
  }
  if (!profile.education_level) {
    eligibilityWarnings.push('Add your education level and graduation year in Settings for sharper eligibility checks.');
  }

  const recommendedResources = missingSkills.slice(0, 4).map((skill) => ({
    topic: skill,
    resourceType: 'Official Docs & Practice',
    action: `Review core ${skill} fundamentals and build a small verification test or mini-module.`,
  }));

  const suggestedProjects = missingSkills.length > 0
    ? [
        {
          title: `${internship.company_name.replace(' (DEMO)', '')} Readiness Mini-Project`,
          scope: `Build a compact focused repository demonstrating ${missingSkills.slice(0, 3).join(', ')} alongside ${matchingSkills.slice(0, 2).join(', ') || 'your core stack'}.`,
          skillsCovered: missingSkills.slice(0, 3),
        },
      ]
    : [
        {
          title: 'Production Hardening & Testing Pass',
          scope: `Add integration tests, observability logs, and a clear architecture README to one of your existing projects for ${internship.title}.`,
          skillsCovered: reqSkills.slice(0, 3),
        },
      ];

  return {
    estimatedMatchPercentage: pct,
    matchingSkills,
    missingSkills,
    requiredSkills: reqSkills,
    preferredSkills: prefSkills,
    eligibilityWarnings,
    recommendedResources,
    suggestedProjects,
    explanation: `Deterministic comparison found ${matchingSkills.length} overlapping skills and ${missingSkills.length} skill gaps against the extracted listing requirements. Match percentages are estimates for preparation planning, not selection guarantees.`,
    usedAi: false,
  };
}

export async function analyzeSkillMatchWithAI(
  profile: StudentProfileInput,
  internship: InternshipInput
): Promise<SkillMatchOutput> {
  const ai = getGeminiClient();
  if (!ai) {
    return computeDeterministicMatch(profile, internship);
  }

  try {
    const prompt = `Compare this student profile with the authentic internship posting.
Be objective, honest, and helpful. Never fabricate requirements not supported by the posting text.
Remember: the match percentage is an estimate for preparation, not a guarantee of selection.

STUDENT PROFILE:
- Education: ${profile.education_level || 'Not specified'} in ${profile.degree_branch || 'Not specified'} (Graduating ${profile.graduation_year || 'Not specified'})
- Skills: ${profile.skills.join(', ') || 'None listed'}
- Languages: ${profile.languages.join(', ') || 'None listed'}
- Projects: ${profile.projects.map((p) => `${p.title} (${p.stack}): ${p.summary}`).join(' | ') || 'None listed'}

INTERNSHIP POSTING:
- Company: ${internship.company_name}
- Title: ${internship.title}
- Eligibility stated: ${internship.eligibility}
- Extracted Required Skills: ${internship.required_skills.join(', ') || 'Extract from description'}
- Extracted Preferred Skills: ${internship.preferred_skills.join(', ') || 'Extract from description'}
- Description excerpt: ${internship.description.slice(0, 3200)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an honest, encouraging technical career advisor. Output structured JSON comparing a student profile against an internship description. Keep explanations concise, actionable, and grounded strictly in the provided text.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedMatchPercentage: { type: Type.INTEGER },
            matchingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            requiredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            preferredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            eligibilityWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedResources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  resourceType: { type: Type.STRING },
                  action: { type: Type.STRING },
                },
              },
            },
            suggestedProjects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  scope: { type: Type.STRING },
                  skillsCovered: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
            },
            explanation: { type: Type.STRING },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return {
      estimatedMatchPercentage: Math.min(98, Math.max(5, Number(parsed.estimatedMatchPercentage) || 50)),
      matchingSkills: Array.isArray(parsed.matchingSkills) ? parsed.matchingSkills : [],
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
      requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills : internship.required_skills,
      preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills : internship.preferred_skills,
      eligibilityWarnings: Array.isArray(parsed.eligibilityWarnings) ? parsed.eligibilityWarnings : [],
      recommendedResources: Array.isArray(parsed.recommendedResources) ? parsed.recommendedResources : [],
      suggestedProjects: Array.isArray(parsed.suggestedProjects) ? parsed.suggestedProjects : [],
      explanation:
        typeof parsed.explanation === 'string' && parsed.explanation
          ? parsed.explanation
          : 'AI comparison completed based on your current profile and the posting requirements.',
      usedAi: true,
    };
  } catch (err) {
    console.warn('Gemini skill match fallback triggered:', err instanceof Error ? err.message : err);
    return computeDeterministicMatch(profile, internship);
  }
}

export async function generateCareerRecommendationsWithAI(
  profile: StudentProfileInput,
  marketTopSkills: Array<{ skill: string; count: number }>
): Promise<{
  focusSkills: Array<{ skill: string; reason: string }>;
  learningActivities: string[];
  projectIdeas: Array<{ title: string; outcome: string }>;
  usedAi: boolean;
}> {
  const studentLower = new Set([...profile.skills, ...profile.languages].map((s) => s.toLowerCase()));
  const missingFromMarket = marketTopSkills
    .filter((m) => !studentLower.has(m.skill.toLowerCase()))
    .slice(0, 4);

  const ai = getGeminiClient();
  if (!ai) {
    return {
      focusSkills: missingFromMarket.map((m) => ({
        skill: m.skill,
        reason: `Appears in ${m.count} active verified internship listings on InternRadar.`,
      })),
      learningActivities: [
        'Dedicate 45 minutes daily to building and testing a feature using a target gap skill.',
        'Read one official engineering architecture post and summarize key takeaways.',
      ],
      projectIdeas: [
        {
          title: 'Verified API Integration Service',
          outcome: 'Demonstrates clean error handling, automated tests, and structured data persistence.',
        },
      ],
      usedAi: false,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Student skills: ${profile.skills.join(', ')}. Languages: ${profile.languages.join(', ')}. Preferred roles: ${profile.preferred_roles.join(', ')}.
Top demanded skills across currently verified open internships: ${marketTopSkills.map((m) => `${m.skill} (${m.count})`).join(', ')}.
Provide 3 prioritized focus skills to improve, 3 concrete learning activities, and 2 portfolio project ideas.`,
      config: {
        systemInstruction: 'Return concise, practical, encouraging student career recommendations in JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            focusSkills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  skill: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
              },
            },
            learningActivities: { type: Type.ARRAY, items: { type: Type.STRING } },
            projectIdeas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  outcome: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '{}').trim());
    return {
      focusSkills: Array.isArray(parsed.focusSkills) ? parsed.focusSkills : [],
      learningActivities: Array.isArray(parsed.learningActivities) ? parsed.learningActivities : [],
      projectIdeas: Array.isArray(parsed.projectIdeas) ? parsed.projectIdeas : [],
      usedAi: true,
    };
  } catch (err) {
    console.warn('Gemini career recommendations fallback:', err instanceof Error ? err.message : err);
    return {
      focusSkills: missingFromMarket.map((m) => ({
        skill: m.skill,
        reason: `Requested across ${m.count} active verified listings.`,
      })),
      learningActivities: [
        'Practice core system design & API debugging for 30 minutes.',
        'Document measurable outcomes on your strongest existing portfolio project.',
      ],
      projectIdeas: [
        {
          title: 'End-to-End Observability & Testing Showcase',
          outcome: 'Highlights production readiness and clean modular code.',
        },
      ],
      usedAi: false,
    };
  }
}

export async function summarizeNewsArticleWithAI(
  title: string,
  publisher: string,
  excerpt: string
): Promise<{
  aiSummary: string;
  whyItMatters: string;
  relatedSkills: string[];
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      aiSummary: excerpt.slice(0, 220) + (excerpt.length > 220 ? '...' : ''),
      whyItMatters: `Relevant engineering update from ${publisher} covering current tooling and industry practices for student builders.`,
      relatedSkills: ['Software Engineering', 'System Design'],
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Summarize this verified technology article for university students preparing for software and technical internships.
Title: ${title}
Publisher: ${publisher}
Excerpt: ${excerpt.slice(0, 1800)}`,
      config: {
        systemInstruction:
          'Provide a factual 2-sentence summary, a 1-2 sentence explanation of why it matters to internship candidates, and 2-4 related technical skills.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiSummary: { type: Type.STRING },
            whyItMatters: { type: Type.STRING },
            relatedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '{}').trim());
    return {
      aiSummary: parsed.aiSummary || excerpt.slice(0, 200),
      whyItMatters: parsed.whyItMatters || `Useful industry context from ${publisher}.`,
      relatedSkills: Array.isArray(parsed.relatedSkills) ? parsed.relatedSkills.slice(0, 4) : ['Software Engineering'],
    };
  } catch {
    return {
      aiSummary: excerpt.slice(0, 220) + (excerpt.length > 220 ? '...' : ''),
      whyItMatters: `Industry context from ${publisher} relevant to modern technical teams.`,
      relatedSkills: ['Software Engineering'],
    };
  }
}
