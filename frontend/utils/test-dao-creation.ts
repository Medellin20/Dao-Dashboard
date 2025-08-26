import { daoService } from "@/services/daoService";
import { devLog } from "@/utils/devLogger";

/**
 * Test de création de DAO avec données minimales
 */
export async function testDaoCreation() {
  devLog.log("🧪 Test de création de DAO...");

  const testDao = {
    numeroListe: "DAO-TEST-001",
    objetDossier: "Test de création de DAO - Objet du dossier de test",
    reference: "REF-TEST-001",
    autoriteContractante: "Autorité de test",
    dateDepot: "2025-12-31",
    equipe: [
      {
        id: "test-leader-1",
        name: "Chef Test",
        role: "chef_equipe" as const,
        email: "chef@test.com",
      },
      {
        id: "test-member-1",
        name: "Membre Test",
        role: "membre_equipe" as const,
        email: "membre@test.com",
      },
    ],
  };

  try {
    devLog.log("📋 Données de test:", testDao);

    const createdDao = await daoService.createDao(testDao);

    devLog.log("✅ DAO créé avec succès:", createdDao);
    return createdDao;
  } catch (error) {
    devLog.error("❌ Erreur lors de la création:", error);

    if (error instanceof Error) {
      devLog.error("Message d'erreur:", error.message);
      devLog.error("Stack trace:", error.stack);
    }

    return null;
  }
}

/**
 * Test avec Ctrl+Shift+C
 */
if (typeof window !== "undefined") {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey && event.shiftKey && event.key === "C") {
      testDaoCreation();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
}
