import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [cvs, setCvs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [portfolioLinks, setPortfolioLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/documents/`, {
        headers: getAuthHeaders()
      });
      const docs = response.data;
      setDocuments(docs);
      setCvs(docs.filter(d => d.document_type === 'cv'));
      setPortfolioLinks(docs.filter(d => d.document_type === 'portfolio_link'));
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/documents/templates/`, {
        headers: getAuthHeaders()
      });
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, []);

  const uploadDocument = async (formData) => {
    const response = await axios.post(`${API_URL}/api/documents/upload`, formData, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });
    await fetchDocuments();
    return response.data;
  };

  const createLink = async (data) => {
    const response = await axios.post(`${API_URL}/api/documents/link`, null, {
      headers: getAuthHeaders(),
      params: data
    });
    await fetchDocuments();
    return response.data;
  };

  const createTemplate = async (data) => {
    const response = await axios.post(`${API_URL}/api/documents/templates`, data, {
      headers: getAuthHeaders()
    });
    await fetchTemplates();
    return response.data;
  };

  const deleteDocument = async (documentId) => {
    await axios.delete(`${API_URL}/api/documents/${documentId}`, {
      headers: getAuthHeaders()
    });
    await fetchDocuments();
  };

  const deleteTemplate = async (templateId) => {
    await axios.delete(`${API_URL}/api/documents/templates/${templateId}`, {
      headers: getAuthHeaders()
    });
    await fetchTemplates();
  };

  const generateFromTemplate = async (templateId, entreprise, poste, applicationId = null) => {
    const response = await axios.post(
      `${API_URL}/api/documents/templates/${templateId}/generate`,
      null,
      {
        headers: getAuthHeaders(),
        params: { entreprise, poste, application_id: applicationId }
      }
    );
    return response.data;
  };

  const linkDocumentToApplication = async (applicationId, documentId) => {
    const response = await axios.post(
      `${API_URL}/api/documents/link-to-application`,
      null,
      {
        headers: getAuthHeaders(),
        params: { application_id: applicationId, document_id: documentId }
      }
    );
    return response.data;
  };

  const getApplicationDocuments = async (applicationId) => {
    const response = await axios.get(
      `${API_URL}/api/documents/application/${applicationId}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  };

  const getDefaultCV = () => {
    return cvs.find(cv => cv.is_default) || cvs[0] || null;
  };

  const getDefaultTemplate = () => {
    return templates.find(t => t.is_default) || templates[0] || null;
  };

  useEffect(() => {
    fetchDocuments();
    fetchTemplates();
  }, [fetchDocuments, fetchTemplates]);

  return {
    documents,
    cvs,
    templates,
    portfolioLinks,
    loading,
    fetchDocuments,
    fetchTemplates,
    uploadDocument,
    createLink,
    createTemplate,
    deleteDocument,
    deleteTemplate,
    generateFromTemplate,
    linkDocumentToApplication,
    getApplicationDocuments,
    getDefaultCV,
    getDefaultTemplate
  };
}
