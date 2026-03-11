import { Defect, Drawing, Project } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// Helper to handle API responses
async function handleResponse(response: Response) {
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }
    if (response.status === 403) {
      throw new Error('MISSING_SCOPES');
    }
    const error = await response.json();
    throw new Error(error.error?.message || 'API Request Failed');
  }
  return response.json();
}

/**
 * Uploads a file to a specific Google Drive folder.
 * Uses a 2-step process (metadata then media) for reliable uploads.
 */
export async function uploadFileToDrive(
  file: File,
  folderId: string,
  accessToken: string
): Promise<{ id: string; url: string }> {
  // 1. Create metadata
  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const createRes = await fetch(`${DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });
  const fileMeta = await handleResponse(createRes);

  // 2. Upload content
  const uploadRes = await fetch(`${UPLOAD_API}/files/${fileMeta.id}?uploadType=media&supportsAllDrives=true`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  await handleResponse(uploadRes);

  // 3. Get webViewLink
  const getRes = await fetch(`${DRIVE_API}/files/${fileMeta.id}?fields=id,webViewLink&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const finalData = await handleResponse(getRes);

  return { id: finalData.id, url: finalData.webViewLink };
}

/**
 * Creates a new Google Sheet in the specified folder if it doesn't exist.
 * Returns the spreadsheet ID.
 */
export async function createOrGetDatabaseSheet(
  folderId: string,
  accessToken: string
): Promise<string> {
  // 1. Search for existing "Defects_Database" sheet in the folder
  const query = `name='Defects_Database' and '${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const searchRes = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  const searchData = await handleResponse(searchRes);
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Create a new sheet directly in the folder
  const createRes = await fetch(`${DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Defects_Database',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId]
    }),
  });
  
  const createData = await handleResponse(createRes);
  const spreadsheetId = createData.id;

  // 3. Initialize sheets
  const initRes = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { updateSheetProperties: { properties: { sheetId: 0, title: 'Projects' }, fields: 'title' } },
        { addSheet: { properties: { title: 'Drawings' } } },
        { addSheet: { properties: { title: 'Defects' } } }
      ]
    })
  });
  await handleResponse(initRes);

  // 4. Initialize headers
  const headersRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'Projects!A1:E1', values: [['ID', 'Name', 'Description', 'CreatedAt', 'CreatedBy']] },
        { range: 'Drawings!A1:D1', values: [['ID', 'ProjectID', 'Name', 'URL']] },
        { range: 'Defects!A1:L1', values: [['ID', 'ProjectID', 'Title', 'Description', 'Status', 'X', 'Y', 'DrawingID', 'CreatedAt', 'CreatedBy', 'Assignee', 'Attachments']] }
      ]
    })
  });
  await handleResponse(headersRes);

  return spreadsheetId;
}

export async function appendProjectToSheet(spreadsheetId: string, project: Project, accessToken: string) {
  const row = [project.id, project.name, project.description, project.createdAt, project.createdBy];
  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/Projects!A:E:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  return handleResponse(response);
}

export async function appendDrawingToSheet(spreadsheetId: string, drawing: Drawing, accessToken: string) {
  const row = [drawing.id, drawing.projectId, drawing.name, drawing.url];
  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/Drawings!A:D:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  return handleResponse(response);
}

export async function appendDefectToSheet(spreadsheetId: string, defect: Defect, accessToken: string) {
  const row = [
    defect.id, defect.projectId, defect.title, defect.description, defect.status,
    defect.x?.toString() || '', defect.y?.toString() || '', defect.drawingId || '', defect.createdAt,
    defect.createdBy, defect.assignee || '', JSON.stringify(defect.attachments || [])
  ];
  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/Defects!A:L:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  return handleResponse(response);
}

export async function overwriteSheetData(
  spreadsheetId: string, 
  projects: Project[], 
  drawings: Drawing[], 
  defects: Defect[], 
  accessToken: string
) {
  // Clear existing data
  const clearRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ranges: ['Projects!A2:E', 'Drawings!A2:D', 'Defects!A2:L']
    })
  });
  await handleResponse(clearRes);

  const data = [];
  
  if (projects.length > 0) {
    data.push({
      range: 'Projects!A2',
      values: projects.map(p => [p.id, p.name, p.description, p.createdAt, p.createdBy])
    });
  }
  
  if (drawings.length > 0) {
    data.push({
      range: 'Drawings!A2',
      values: drawings.map(d => [d.id, d.projectId, d.name, d.url])
    });
  }
  
  if (defects.length > 0) {
    data.push({
      range: 'Defects!A2',
      values: defects.map(d => [
        d.id, d.projectId, d.title, d.description, d.status,
        d.x?.toString() || '', d.y?.toString() || '', d.drawingId || '', d.createdAt,
        d.createdBy, d.assignee || '', JSON.stringify(d.attachments || [])
      ])
    });
  }

  if (data.length > 0) {
    const updateRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data
      })
    });
    await handleResponse(updateRes);
  }
}

export async function getDatabaseData(spreadsheetId: string, accessToken: string) {
  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchGet?ranges=Projects!A2:E&ranges=Drawings!A2:D&ranges=Defects!A2:L`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await handleResponse(response);
  
  const projects = (data.valueRanges[0].values || []).map((row: any[]) => ({
    id: row[0], name: row[1], description: row[2], createdAt: row[3], createdBy: row[4]
  }));
  
  const drawings = (data.valueRanges[1].values || []).map((row: any[]) => ({
    id: row[0], projectId: row[1], name: row[2], url: row[3]
  }));
  
  const defects = (data.valueRanges[2].values || []).map((row: any[]) => ({
    id: row[0], projectId: row[1], title: row[2], description: row[3], status: row[4],
    x: row[5] ? parseFloat(row[5]) : undefined, 
    y: row[6] ? parseFloat(row[6]) : undefined, 
    drawingId: row[7] || undefined,
    createdAt: row[8], createdBy: row[9], assignee: row[10],
    attachments: row[11] ? JSON.parse(row[11]) : []
  }));

  return { projects, drawings, defects };
}
