export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { garment_img, model_index, prompt, garment_type, custom_model, custom_bg } = req.body;
  if (!garment_img) return res.status(400).json({ error: 'Missing image' });

  const modelIdx = parseInt(model_index) || 0;
  console.log('Model index:', modelIdx, 'Garment type:', garment_type);

  const models = [
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461285245.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/fashn-export-1777461108131.jpeg',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2001_56_44%20AM.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2001_57_37%20AM.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2001_59_01%20AM.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/ChatGPT%20Image%20May%204,%202026,%2002_01_12%20AM.png',
  ];

  // ── MANNEQUIN IMAGES ──
  // Upload these 2 mannequin images to your Supabase storage bucket "models" folder
  // and update the URLs below. Use a plain white dress form mannequin photo.
  // Recommended: full-body front-facing white mannequin on white/grey background
  const mannequinModels = [
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/mannequin_front.png',
    'https://oqmoneclnirnhqpcdeqy.supabase.co/storage/v1/object/public/models/mannequin_side.jpg',
  ];

  const isSaree = garment_type === 'saree';

  try {
    // Upload garment to Imgur
    const base64Data = garment_img.replace(/^data:image\/\w+;base64,/, '');
    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { 'Authorization': 'Client-ID 546c25a59c58ad7', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data, type: 'base64' })
    });
    const imgurData = await imgurRes.json();
    if (!imgurData.success) return res.status(500).json({ error: 'Image upload failed' });
    const garmentUrl = imgurData.data.link;

    // ── MANNEQUIN MODE (index 98) ──
    if (modelIdx === 98) {
      const mannequinDescMap = {
        'salwar':       'salwar suit with churidar on dress form mannequin, standing front facing, full length',
        'kurti':        'kurti with leggings on dress form mannequin, standing front facing, full length',
        'anarkali':     'anarkali flared floor-length suit on dress form mannequin, standing front facing, full length',
        'frock':        'frock style Indian suit on dress form mannequin, standing front facing, full length',
        'palazzo':      'palazzo set with wide leg pants on dress form mannequin, standing front facing, full length',
        'sharara':      'sharara set with flared bottoms on dress form mannequin, standing front facing, full length',
        'lehenga':      'lehenga choli with flared skirt on dress form mannequin, standing front facing, full length',
        'indo-western': 'indo-western fusion outfit on dress form mannequin, standing front facing, full length',
        'saree':        'saree draped elegantly on dress form mannequin, standing front facing, full length',
        'patiala':      'patiala suit with puffy salwar on dress form mannequin, standing front facing, full length',
        'dhoti':        'dhoti style pants with kurta on dress form mannequin, standing front facing, full length',
        'coord':        'matching co-ord set on dress form mannequin, standing front facing, full length',
        'pakistani':    'heavy embroidered Pakistani straight suit on dress form mannequin, standing front facing, full length',
        'georgette':    'georgette embroidered suit on dress form mannequin, standing front facing, full length',
        'suit':         'salwar suit on dress form mannequin, standing front facing, full length',
      };

      const garmentDesc = mannequinDescMap[garment_type] || mannequinDescMap['suit'];

      // Extract scene from prompt (background part) — everything after first 2 parts
      const promptParts = (prompt || '').split(',');
      const scenePart = promptParts.slice(2).join(',').trim() ||
        'clean white studio background, soft professional studio lighting, high fashion product photography';

      const mannequinPrompt = [
        garmentDesc,
        scenePart,
        'professional product fashion photography, 4K high quality, sharp fabric details, full outfit visible'
      ].join(', ');

      console.log('Mannequin prompt:', mannequinPrompt);

      const mannequinBody = {
        model_name: 'product-to-model',
        inputs: {
          product_image: garmentUrl,
          model_image: mannequinModels[0],
          resolution: '1k',
          generation_mode: 'balanced',
          output_format: 'jpeg',
          prompt: mannequinPrompt,
        }
      };

      const mannequinRes = await fetch('https://api.fashn.ai/v1/run', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mannequinBody)
      });

      const mannequinText = await mannequinRes.text();
      console.log('Mannequin FASHN response:', mannequinText.substring(0, 300));

      let mannequinData;
      try { mannequinData = JSON.parse(mannequinText); }
      catch(e) { return res.status(500).json({ error: 'Bad JSON from FASHN: ' + mannequinText.substring(0, 200) }); }

      if (mannequinData.error) return res.status(500).json({ error: String(mannequinData.error) });
      if (!mannequinData.id) return res.status(500).json({ error: 'No ID returned from FASHN' });

      return res.status(200).json({ prediction_id: mannequinData.id, status: mannequinData.status });
    }

    // ── HUMAN MODEL MODE ──
    let humanImg;
    if (custom_model && custom_model.startsWith('data:')) {
      const customBase64 = custom_model.replace(/^data:image\/\w+;base64,/, '');
      const customImgurRes = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { 'Authorization': 'Client-ID 546c25a59c58ad7', 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: customBase64, type: 'base64' })
      });
      const customImgurData = await customImgurRes.json();
      humanImg = customImgurData.success ? customImgurData.data.link : models[0];
    } else {
      humanImg = models[modelIdx] || models[0];
      console.log('Using model:', modelIdx, humanImg);
    }

    // All 14 garment type descriptions
    const garmentDescMap = {
      'salwar':       'Indian woman wearing a beautiful salwar suit with straight-cut churidar and dupatta draped over shoulder, full length',
      'kurti':        'Indian woman wearing a stylish long kurti with fitted leggings or pants, full length',
      'anarkali':     'Indian woman wearing a gorgeous flared Anarkali suit with long dupatta, floor-length ethnic gown, full length',
      'frock':        'Indian woman wearing a knee-length frock-style Indian suit with flared skirt, churidar and dupatta, full length',
      'palazzo':      'Indian woman wearing a palazzo set with wide flowy palazzo pants and matching embroidered kurta, full length',
      'sharara':      'Indian woman wearing a festive sharara set with heavily flared sharara pants and short kurta with dupatta, full length',
      'lehenga':      'Indian woman wearing a stunning bridal lehenga choli with embroidered skirt and dupatta, full length',
      'indo-western': 'Indian woman wearing a fusion Indo-Western outfit with cape or jacket over ethnic dress, full length',
      'saree':        'Indian woman wearing an elegant saree with pallu draped gracefully over left shoulder, full length',
      'patiala':      'Indian woman wearing a Patiala suit with puffy gathered Patiala salwar and long kurta with dupatta, full length',
      'dhoti':        'Indian woman wearing dhoti-style pants with matching kurta, modern ethnic drape, full length',
      'coord':        'Indian woman wearing a matching ethnic co-ord set with coordinated top and bottom, full length',
      'pakistani':    'Indian woman wearing a heavy embroidered Pakistani-style straight-cut suit with gold zari embroidery, cigarette-cut salwar, embroidered dupatta, full length',
      'georgette':    'Indian woman wearing an elegant georgette embroidered suit with sheer flowing kurta and sequin zari work, full length',
      'suit':         'Indian woman wearing a beautiful salwar suit with dupatta, full length',
    };
    const garmentDesc = garmentDescMap[garment_type] || garmentDescMap['suit'];

    // Build final prompt — use frontend-built prompt (includes pose + scene)
    let finalPrompt = prompt || '';
    if (!finalPrompt || finalPrompt === 'custom_bg_upload') {
      finalPrompt = garmentDesc + ', standing straight facing forward, professional Indian fashion photography, high quality';
    }

    // Custom background: use Claude Vision to describe the scene, inject into prompt
    // This makes FASHN generate the model naturally IN the scene rather than compositing
    if (custom_bg && custom_bg.startsWith('data:')) {
      try {
        const posePart = (prompt || '').split(',').slice(1, 3).join(',').trim() || 'standing straight, graceful pose';
        // Extract base64 from data URL
        const bgBase64 = custom_bg.replace(/^data:image\/\w+;base64,/, '');
        const bgMediaType = custom_bg.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

        // Ask Claude to describe the background scene
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 120,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: bgMediaType, data: bgBase64 }
                },
                {
                  type: 'text',
                  text: 'Describe this background location in 8-12 words for a fashion photo prompt. Focus on the setting, lighting, and atmosphere only. No people. Example format: "Rajasthani fort courtyard, warm golden hour lighting, stone architecture"'
                }
              ]
            }]
          })
        });

        const claudeData = await claudeRes.json();
        const sceneDesc = claudeData.content?.[0]?.text?.trim() || '';
        console.log('Claude scene description:', sceneDesc);

        if (sceneDesc) {
          finalPrompt = garmentDesc + ', ' + posePart + ', ' + sceneDesc + ', professional Indian fashion photography, photorealistic, 4K quality, natural lighting';
        } else {
          finalPrompt = garmentDesc + ', ' + posePart + ', professional Indian fashion photography, high quality';
        }
      } catch(e) {
        console.log('Claude vision failed, using neutral prompt:', e.message);
        const posePart = (prompt || '').split(',').slice(1, 3).join(',').trim() || 'standing straight';
        finalPrompt = garmentDesc + ', ' + posePart + ', professional Indian fashion photography, high quality';
      }
    }

    const requestBody = {
      model_name: 'product-to-model',
      inputs: {
        product_image: garmentUrl,
        model_image: humanImg,
        resolution: '1k',
        generation_mode: 'balanced',
        output_format: 'jpeg',
        prompt: finalPrompt,
      }
    };

    const response = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const text = await response.text();
    console.log('Fashn status:', response.status, text.substring(0, 200));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Bad JSON: ' + text.substring(0, 200) }); }

    if (data.error) return res.status(500).json({ error: typeof data.error === 'object' ? JSON.stringify(data.error) : String(data.error) });
    if (!data.id) return res.status(500).json({ error: 'No ID: ' + JSON.stringify(data).substring(0, 200) });

    return res.status(200).json({ prediction_id: data.id, status: data.status });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
