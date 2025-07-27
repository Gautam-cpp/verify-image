
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NextApiRequest, NextApiResponse } from 'next';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function fetchImageAsBase64(imageUrl: string) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    
    return {
      inlineData: {
        data: Buffer.from(buffer).toString("base64"),
        mimeType,
      },
    };
  } catch (error) {
    console.error('Error fetching image:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method Not Allowed. Only POST requests are accepted.' 
    });
  }

  const { imageUrl, productName } = req.body;

  if (!imageUrl || !productName) {
    return res.status(400).json({ 
      message: 'Both imageUrl and productName are required.' 
    });
  }

  try {
    new URL(imageUrl);
  } catch {
    return res.status(400).json({ 
      message: 'Invalid imageUrl format.' 
    });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Improved prompt for better accuracy
    const prompt = `
      Analyze this image carefully and determine if it shows "${productName}".
      Look at the actual visual content of the image, not any text overlays or labels.
      
      Consider:
      - Does the image contain the specific product mentioned?
      - Is the product clearly visible and identifiable?
      - Ignore any text, watermarks, or labels in the image
      
      Product to identify: "${productName}"
      
      Respond with only "yes" if the image clearly shows this product, or "no" if it doesn't.
    `;

    // Fetch and convert image
    const imagePart = await fetchImageAsBase64(imageUrl);

    // Generate content with the model
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text().trim().toLowerCase();

    // Log the AI response for debugging
    console.log(`AI Verification for "${productName}": ${text}`);

    // Determine if it's a match
    const isMatch = text.includes('yes');

    // Return the result
    res.status(200).json({ 
      isMatch,
      aiResponse: text // Optional: include for debugging
    });

  } catch (error) {
    console.error("AI verification failed:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return res.status(400).json({ 
          message: 'Unable to access the provided image URL.' 
        });
      }
      if (error.message.includes('API')) {
        return res.status(503).json({ 
          message: 'AI service temporarily unavailable.' 
        });
      }
    }

    res.status(500).json({ 
      message: 'Failed to verify image with AI. Please try again.' 
    });
  }
}
