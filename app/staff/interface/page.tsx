
"use client";

import { useStaffInterface } from "./hooks/useStaffInterface"; 
import InterfaceHeader from "./components/InterfaceHeader";
import MessageList from "./components/MessageList";
import ReplyModal from "./components/ReplyModal";

/**
 * ORCHESTRATEUR FINAL : StaffInterfacePage
 */
export default function StaffInterfacePage() {
  const {
    // CORRECTION : On extrait 'groupedMessages' car 'filteredMessages' n'existe pas dans le hook
    groupedMessages, 
    loading,
    userEmail,
    view,
    setView,
    
    // États de recherche et UI
    searchRef,
    setSearchRef,
    isSearchingExternal,
    expandedMessages,
    toggleExpand,
    
    // Gestion de la modale de réponse
    replyingTo,
    setReplyingTo,
    replyContent,
    setReplyContent,
    documentLink,
    setDocumentLink,
    isSending,
    
    // Données d'historique
    historyMessages,
    loadingHistory,
    linkedDossiers,
    githubArchive,
    
    // Actions
    handleExternalSearch,
    fetchHistoryAndLinks,
    handleMarkAsReadSilent,
    handleDeepArchive,
    handleSendReply,
    isMarkingRead,
    isArchiving
  } = useStaffInterface();

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-12 font-sans selection:bg-red-600/30">
      <div className="max-w-6xl mx-auto space-y-12">
        
        <InterfaceHeader 
          userEmail={userEmail}
          searchRef={searchRef}
          setSearchRef={setSearchRef}
          isSearchingExternal={isSearchingExternal}
          onExternalSearch={handleExternalSearch}
          view={view}
          setView={setView}
        />

        <MessageList 
          // CORRECTION : On passe 'groupedMessages' au composant
          messages={groupedMessages} 
          loading={loading}
          expandedMessages={expandedMessages}
          toggleExpand={toggleExpand}
          setReplyingTo={setReplyingTo}
          fetchHistoryAndLinks={fetchHistoryAndLinks}
          handleMarkAsReadSilent={handleMarkAsReadSilent}
          handleDeepArchive={handleDeepArchive}
          isMarkingRead={isMarkingRead}
          isArchiving={isArchiving}
        />

        {replyingTo && (
          <ReplyModal 
            replyingTo={replyingTo}
            onClose={() => setReplyingTo(null)}
            userEmail={userEmail}
            historyMessages={historyMessages}
            loadingHistory={loadingHistory}
            linkedDossiers={linkedDossiers}
            githubArchive={githubArchive}
            replyContent={replyContent}
            setReplyContent={setReplyContent}
            documentLink={documentLink}
            setDocumentLink={setDocumentLink}
            isSending={isSending}
            onSendReply={handleSendReply}
          />
        )}
        
      </div>
    </main>
  );
}
