require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// TikTok OAuth Configuration
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.FRONTEND_URL ? process.env.FRONTEND_URL : 'https://agentcontent.info'}`;

// Root endpoint
app.get('/', (req, res) => {
  res.send('TikTok OAuth Backend Server is running!');
});

// New endpoint for posting to TikTok
app.post('/api/post-to-tiktok', async (req, res) => {
  const { open_id, video_url, title, description, privacy_level } = req.body;
  
  if (!open_id || !video_url) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters'
    });
  }
  
  try {
    // Get access token for the user
    // In a production app, you would store this in a database
    // For now, we'll need to fetch a new one each time
    const tokenResponse = await axios({
      method: 'post',
      url: 'https://open.tiktokapis.com/v2/oauth/token/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: open_id // This is a simplification, normally you'd store the refresh token
      }).toString()
    });
    
    const accessToken = tokenResponse.data.access_token;
    
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'No valid access token'
      });
    }
    
    // Ensure privacy level is SELF_ONLY for unaudited apps
    const finalPrivacyLevel = "SELF_ONLY"; // Force SELF_ONLY regardless of what was passed
    
    // Call TikTok API to post the video
    const postResponse = await axios({
      method: 'post',
      url: 'https://open.tiktokapis.com/v2/video/publish/',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        video_url: video_url,
        title: title || "Video from Agent Content",
        description: description || "Posted via Agent Content",
        privacy_level: finalPrivacyLevel
      }
    });
    
    return res.json({
      success: true,
      data: postResponse.data
    });
    
  } catch (error) {
    console.error('Error posting to TikTok:', error.response ? error.response.data : error.message);
    return res.status(500).json({
      success: false,
      error: error.response ? error.response.data : error.message
    });
  }
});

// OAuth callback endpoint
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    console.error('No authorization code received');
    return res.status(400).send('No authorization code received');
  }
  
  console.log('Received authorization code:', code);
  
  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await axios({
      method: 'post',
      url: 'https://open.tiktokapis.com/v2/oauth/token/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `https://tiktok-oauth-backend.onrender.com/auth/callback`
      }).toString()
    });
    
    console.log('Token response:', tokenResponse.data);
    
    const accessToken = tokenResponse.data.access_token;
    
    if (!accessToken) {
      console.error('Failed to get access token:', tokenResponse.data);
      return res.send(`Access Token: undefined`);
    }
    
    // Get user info using the access token
    const userResponse = await axios({
      method: 'get',
      url: 'https://open.tiktokapis.com/v2/user/info/',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        fields: 'open_id,union_id,avatar_url,avatar_url_100,avatar_url_200,display_name,bio_description,profile_deep_link'
      }
    });
    
    console.log('User info:', userResponse.data);
    
    // Redirect back to the frontend with the access token
    // In a production environment, you would store the token securely and use sessions
    res.send(`Access Token: ${accessToken}`);
    
  } catch (error) {
    console.error('Error exchanging code for token:', error.response ? error.response.data : error.message);
    res.send(`Access Token: undefined\nError: ${error.message}`);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 