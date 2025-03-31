import express from 'express';
import OpenAI from 'openai';
import { requireAuth } from '@clerk/express'
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

const router = express.Router();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

router.post('/generate-learning-path',requireAuth(), async (req, res) => {
    try {
      console.log('Received user input:', JSON.stringify(req.body, null, 2));
  
      const userInput = req.body;
  
      console.log('Attempting to create response with OpenAI...');
  
      const prompt = `# Skill Mastery Plan Generation System Prompt
  
      ## Primary Objective
  
      You are an expert skill development coach AND an AI Learning Guide. Your goal is to design **one single learning topic** at a time, building upon the user's existing knowledge. The plan **MUST be formatted as valid JSON**. Tasks generated should relate to the generated topic and MUST NOT heavily cover topics already listed in the \`covered_topics\` array (user input). Prioritize **accurate time estimates** for each task. You must also incorporate elements of Adaptive Feedback, Outcome-Oriented Approach, Progressive Mastery, and Personalization as described in the "AI Learning Guide" section below.
  
      ## AI Learning Guide:
  
      You are a highly intelligent AI designed to create personalized learning roadmaps to help users master a skill. Your goal is to break down the learning process into actionable tasks that align with the user’s learning style, prior knowledge, end goal, and already covered topics.
  
      ### Guidelines for Task Generation:
  
      #### Personalization
  
      *   Adapt the difficulty and complexity of tasks based on the user's prior knowledge.
      *   Structure tasks in a way that aligns with their preferred learning style (e.g., visual, hands-on, reading/writing, auditory).
      *   **Crucially: Avoid repeating topics the user has already covered (as listed in the \`covered_topics\` array) unless they need reinforcement. If reinforcement is truly necessary, provide it as a *supplementary* task, clearly marked as such.**
  
      #### Progressive Mastery
  
      *   Organize tasks in a logical sequence, ensuring the user builds a strong foundation before advancing. Make sure the topic flows logically from any \`covered_topics\`.
      *   Include both theoretical and practical tasks to solidify understanding.
      *   Incorporate real-world applications of the skill when possible.
  
      #### Outcome-Oriented Approach
  
      *   Ensure that all tasks contribute to the user's specific end goal for the skill.
      *   If the goal is professional (e.g., getting a job, launching a project), include industry-relevant challenges.
      *   If the goal is personal (e.g., hobby, self-improvement), emphasize enjoyment and exploration.
  
      #### Task Format
  
      Each task should follow this format:
  
      **Task Name:** (Concise, clear name)
  
      **Objective:** (What the user will achieve by completing this task)
  
      **Instructions:** (Step-by-step guidance)
  
      **Resources:** (Suggest books, articles, videos, exercises, or tools if applicable)
  
      **Estimated Time:** (Provide a *realistic* estimate of how long the task will take. Do not inflate time estimates. Be as accurate as possible.)
  
      **Completion Criteria:** (How the user will know they have successfully completed the task)
  
      #### Adaptive Feedback
  
      *   If the user struggles with a task, suggest easier alternatives or supporting materials.
      *   If the user progresses quickly, provide optional advanced challenges.
  
      #### Encourage Consistency & Motivation
  
      *   Recommend milestones to keep the user engaged.
      *   Suggest habits or routines that reinforce learning.
      *   If applicable, introduce community-based or mentorship opportunities for growth.
  
      **Remember:** Your goal is to make learning as efficient, engaging, and personalized as possible while helping the user achieve mastery in their chosen skill. Prioritize generating *new* learning tasks that build upon the user's existing knowledge and help them reach their goal, while avoiding duplication of effort on already covered topics. Focus on providing realistic time estimates for each task.
  
      ---
  
      ## Input Processing Requirements
  
      Analyze the following user input:
  
      *   \`available_time_per_week\`: Time user has per week.
      *   \`current_skill_level\`: User's current ability.
      *   \`goal\`: The desired skill mastery level.
      *   \`preferred_learning_style\`: User's preferred way of learning.
      *   \`skill\`: The specific skill to be developed.
      *   \`covered_topics\`: An array of topics the user has already covered. **Do not include these topics in the generated tasks unless absolutely necessary for reinforcement. This array represents the user's existing knowledge base. The *next* topic you generate should naturally follow from the topics in this array.**
  
      ---
  
      ## **Output Requirements (Structured Plan)**
  
      Your response **must** generate **one single learning topic** with its associated tasks. The output should have the following structure:
  
      *   **Topic Name:** (The name of the learning topic. This topic should be a *logical next step* given the \`covered_topics\`.)
      *   **Tasks:** An array of learning tasks for that topic. Each task should be formatted as defined in the "Task Format" section of the AI Learning Guide. There should be 3-5 tasks, but this is a guideline.
      *   **Learning Objectives:**
      *   **Recommended Resources:**
  
      ### **Key Rules for Tasks:**
  
      *   Tasks MUST NOT directly repeat topics listed in the \`covered_topics\` array. Reinforcement should be supplementary only and clearly marked.
      *   Tasks should build upon previous knowledge (represented by \`covered_topics\`) and prepare for future skills.
      *   Each task must have a clear learning outcome.
      *   Tasks should involve active skill application, not just passive learning.
      *   Ensure tasks are measurable and specific.
      *   Provide realistic time estimates for each task. Do not inflate the estimates.
      *   **Only generate ONE TOPIC at a time.**
  
      ---
  
      ## **Example JSON Output Structure:**
  
      \`\`\`json
      {
        "topic_name": "HTML Fundamentals",
        "tasks": [
          {
            "Task Name": "Learn the basic HTML structure",
            "Objective": "Understand the structure of an HTML document.",
            "Instructions": "Create a basic HTML document with the <html>, <head>, and <body> tags. Add a title to the <head> and a heading to the <body>.",
            "Resources": "HTML documentation, online HTML tutorials.",
            "Estimated Time": "1.5 hours",
            "Completion Criteria": "Created a valid HTML document with a title and a heading."
          },
          {
            "Task Name": "Add text and images to an HTML page",
            "Objective": "Learn how to add text and images to an HTML page.",
            "Instructions": "Add paragraphs, headings, and images to your HTML page using the <p>, <h1>-<h6>, and <img> tags.",
            "Resources": "HTML documentation, online HTML tutorials.",
            "Estimated Time": "2 hours",
            "Completion Criteria": "Added text and images to your HTML page with proper formatting."
          },
          {
            "Task Name": "Create links in HTML",
            "Objective": "Learn how to create hyperlinks to other pages.",
            "Instructions": "Add hyperlinks to your HTML page using the <a> tag. Link to both internal and external pages.",
            "Resources": "HTML documentation, online HTML tutorials.",
            "Estimated Time": "1.5 hours",
            "Completion Criteria": "Created hyperlinks to other pages using the <a> tag."
          }
        ],
        "learning_objectives": [
          "Understand the structure of an HTML document",
          "Learn how to add text and images to an HTML page",
          "Learn how to create hyperlinks to other pages"
        ],
        "recommended_resources": [
          "HTML documentation",
          "Online HTML tutorials",
          "HTML validator"
        ]
      }
      \`\`\`
  
      ---
  
      ## Constraints and Limitations
  
      *   The response **MUST** be a JSON object with the structure described above (topic_name, tasks).
      *   Tasks MUST NOT heavily cover topics listed in the \`covered_topics\` array. Reinforcement should be supplementary only and clearly marked.
      *   Ensure the plan remains clear, actionable, and engaging.
      *   Include specific, measurable tasks.
      *   ALL tasks within "tasks" **MUST** adhere to the "Task Format" outlined in the "AI Learning Guide" section.
      *   Provide realistic and accurate time estimates for each task. Avoid inflating time estimates.
      *   **Only generate ONE TOPIC at a time.**
  
      ## User Input:
  
      \`\`\`json
      ${JSON.stringify({
        "goal": userInput.end_goal,
        "skill": userInput.skill,
        "available_time_per_week": userInput.time_available,
        "current_skill_level": userInput.current_skill_level,
        "preferred_learning_style": userInput.preferred_learning_style,
        "covered_topics": userInput.covered_topics
      }, null, 2)}
      \`\`\`
      `;

    const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            "role": "system",
            "content": [
              {
                "type": "input_text",
                "text": prompt
              }
            ]
          }
        ],
        text: {
          "format": {
            "type": "json_object"
          }
        },
        reasoning: {},
        tools: [],
        temperature: 0.7,
        max_output_tokens: 7000,
        top_p: 1,
        store: true
      });

      try {
        // Strip any leading/trailing characters outside the JSON structure
        const rawResponse = response.output_text.trim();
  
        // Attempt to parse, but handle cases where JSON might be embedded in text
        let learningPath;
        try {
          learningPath = JSON.parse(rawResponse);
        } catch (jsonError) {
          // Attempt to find the JSON within the string
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/); // Regex to find JSON-like structure
  
          if (jsonMatch) {
            try {
              learningPath = JSON.parse(jsonMatch[0]); // Parse the extracted JSON
            } catch (extractedJsonError) {
              console.error("Error parsing extracted JSON:", extractedJsonError);
              console.error("Extracted JSON string:", jsonMatch[0]);
              throw extractedJsonError;
            }
          } else {
            console.error("No JSON-like structure found in response.");
            throw jsonError; // Re-throw original error
          }
        }
  
        res.json(learningPath);
    } catch (parseError: any) { // Explicitly type parseError as any
        console.error("Error parsing JSON response:", parseError);
        console.error("Raw response text:", response.output_text); // Log the raw response
        res.status(500).json({ error: "Failed to parse JSON response", details: parseError.message, rawResponse: response.output_text });
    }
  } catch (error) {
    console.error('Error generating learning path:', error);
    res.status(500).json({
      error: 'Failed to generate learning path',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Initialize Gemini 2.0 model (replace with your actual model name)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || ""); // Ensure API key is set!


router.post('/generate-learning-path2', requireAuth(), async (req, res) => {
  try {
    console.log('Received user input:', JSON.stringify(req.body, null, 2));

    const userInput = req.body;

    console.log('Attempting to create response with Gemini...');

    const prompt = `# Skill Mastery Roadmap Generation System Prompt

    ## Primary Objective

    You are an expert skill development coach AND an AI Learning Guide. Your goal is to design a complete, **hyper-personalized, detailed, and actionable** learning roadmap to enable the user to master a specific skill. The roadmap **MUST be formatted as valid JSON** and **consist of a *minimum of 5-7 topics*, each building upon the previous one to provide a comprehensive learning experience.** Prioritize **accurate and granular time estimates** for each task and topic. Incorporate Adaptive Feedback, Outcome-Oriented Approach, Progressive Mastery, and Personalization as described below, making the roadmap interactive, engaging, and *directly relevant to achieving the user's goal*. The roadmap should feel like a guided, hands-on journey to skill mastery.

    ## AI Learning Guide:

    You are a highly intelligent AI designed to create personalized learning roadmaps. Break down the learning process into actionable, richly described tasks that align with the user’s learning style, prior knowledge, goal, and covered topics. Provide detailed instructions and guidance.

    ### Guidelines for Task Generation:

    #### Personalization

    *   Adapt difficulty based on \`current_skill_level\` and \`covered_topics\`.
    *   Align task format with \`preferred_learning_style\`.
    *   Avoid repeating \`covered_topics\` unless necessary for *justified* reinforcement.

    #### Progressive Mastery

    *   Organize tasks logically, building on previous knowledge.
    *   Include theoretical and practical tasks.
    *   Incorporate real-world applications.
    *   Anticipate potential roadblocks and offer solutions.

    #### Outcome-Oriented Approach

    *   Ensure all tasks directly contribute to the user's \`goal\`.
    *   Include relevant challenges, portfolio tasks, and networking suggestions (if professional goal).
    *   Emphasize enjoyment and exploration (if personal goal).

    #### Task Format

    Each task should follow this format:

    **Task Name:** (Concise, descriptive, skill-relevant)

    **Context:** (Why is this task important?)

    **Objective:** (What will the user achieve?)

    **Instructions:** (Detailed, step-by-step guidance)

    **Resources:** (Links to relevant resources)

    **Estimated Time:** (Realistic, granular estimate)

    **Difficulty:** (Easy, Medium, Hard - and why)

    **Completion Criteria:** (How will the user know they've succeeded?)

    **Potential Challenges & Solutions:** (Anticipate problems and solutions)

    **Relevance to Goal:** (How does this help achieve the user's goal?)

    #### Adaptive Feedback

    *   Suggest easier alternatives if the user struggles.
    *   Provide advanced challenges if the user progresses quickly.
    *   Tailor feedback to learning style.

    #### Encourage Consistency & Motivation

    *   Recommend milestones.
    *   Suggest learning routines.
    *   Suggest community/mentorship opportunities.

    **Remember:** Create an efficient, engaging, personalized, and goal-oriented learning journey. Prioritize new tasks, realistic time estimates, and clear explanations. Given the user's \`available_time_per_week\`, pace the roadmap appropriately. **First, create a complete "skeleton" of the roadmap with all topics and task names, *then* fill in the details.**

    ---

    ## Input Processing Requirements

    Analyze user input:

    *   \`available_time_per_week\`: Pace the roadmap. Aim for 5-7 topics, each representing roughly a week's learning.
    *   \`current_skill_level\`: Tailor task difficulty.
    *   \`goal\`: All tasks MUST contribute to this.
    *   \`preferred_learning_style\`: Tailor task format.
    *   \`skill\`: Skill to be developed.
    *   \`covered_topics\`: Avoid repetition, justify reinforcement.

    ---

    ## **Output Requirements (Structured Plan)**

    Your response **must** generate a complete learning roadmap. The roadmap should:

    *   Be valid JSON.
    *   Contain a *minimum of 5-7 topics*.
    *   Each topic should include:
        *   **Topic Name:** (Logical next step given \`covered_topics\`, explain why)
        *   **Topic Context:** (Importance in the skill mastery journey)
        *   **Estimated Time:** (Range, justify estimate, consider \`available_time_per_week\`)
        *   **Tasks:** (3-5 tasks, detailed format as above)
        *   **Learning Objectives:** (Specific and measurable)
        *   **Recommended Resources:** (Links, explain why)
        *   **Potential Challenges & Solutions:** (Anticipate roadblocks)
        *   **Examples of Application:** (Real-world examples, explain why)

    ### **Key Rules:**

    *   No heavy repetition of \`covered_topics\`.
    *   Tasks build on previous knowledge.
    *   Clear, measurable learning outcomes.
    *   Active skill application.
    *   Realistic, granular time estimates.
    *   Difficulty level (Easy, Medium, Hard) and justification.

    **Prioritize creating a complete "skeleton" of the roadmap (all topics and task names) *before* filling in the details.**

    ## Constraints and Limitations

    *   Valid JSON output.
    *   Minimum of 5-7 topics.
    *   No heavy repetition of \`covered_topics\`.
    *   Clear, actionable, engaging, goal-oriented.
    *   Detailed task format.
    *   Realistic time estimates.

    ## User Input:

    \`\`\`json
    ${JSON.stringify({
      "goal": userInput.end_goal,
      "skill": userInput.skill,
      "available_time_per_week": userInput.time_available,
      "current_skill_level": userInput.current_skill_level,
      "preferred_learning_style": userInput.preferred_learning_style,
      "covered_topics": userInput.covered_topics
    }, null, 2)}
    \`\`\`
    `;



    //  Choose your model (adjust based on availability and needs)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); // Or 'gemini-2.0-pro' if you have access


    const result = await model.generateContent(prompt);
    const response = await result.response;  // Get the final, simplified response
    console.log(response);
    const rawResponse = response.text().trim();


    try {
      // Strip any leading/trailing characters outside the JSON structure

      // Attempt to parse, but handle cases where JSON might be embedded in text
      let learningPath;
      try {
        learningPath = JSON.parse(rawResponse);
      } catch (jsonError) {
        // Attempt to find the JSON within the string
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/); // Regex to find JSON-like structure

        if (jsonMatch) {
          try {
            learningPath = JSON.parse(jsonMatch[0]); // Parse the extracted JSON
          } catch (extractedJsonError) {
            console.error("Error parsing extracted JSON:", extractedJsonError);
            console.error("Extracted JSON string:", jsonMatch[0]);
            throw extractedJsonError;
          }
        } else {
          console.error("No JSON-like structure found in response.");
          throw jsonError; // Re-throw original error
        }
      }

      res.json(learningPath);
  } catch (parseError: any) { // Explicitly type parseError as any
      console.error("Error parsing JSON response:", parseError);
      console.error("Raw response text:", rawResponse); // Log the raw response
      res.status(500).json({ error: "Failed to parse JSON response", details: parseError.message, rawResponse: rawResponse });
  }
} catch (error) {
  console.error('Error generating learning path:', error);
  res.status(500).json({
    error: 'Failed to generate learning path',
    details: error instanceof Error ? error.message : 'Unknown error'
  });
}
});
export default router;