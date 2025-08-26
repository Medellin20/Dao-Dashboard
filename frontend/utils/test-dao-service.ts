import { daoService } from "@/services/daoService";
import { devLog } from "@/utils/devLogger";

/**
 * Test script pour vérifier le bon fonctionnement du nouveau service DAO
 */
export async function testDaoService() {
  devLog.log("🧪 Test du service DAO...");

  try {
    // Test 1: Récupération de tous les DAO
    devLog.log("📋 Test 1: Récupération de tous les DAO");
    const daos = await daoService.getAllDaos();
    devLog.log(`✅ ${daos.length} DAO récupérés`);

    if (daos.length > 0) {
      const firstDao = daos[0];
      
      // Test 2: Récupération d'un DAO spécifique
      devLog.log("📋 Test 2: Récupération d'un DAO spécifique");
      const singleDao = await daoService.getDaoById(firstDao.id);
      devLog.log(`✅ DAO récupéré: ${singleDao.numeroListe}`);

      // Test 3: Calcul du statut et progrès
      devLog.log("📋 Test 3: Calculs de statut et progrès");
      const status = daoService.getDaoStatus(firstDao);
      const progress = daoService.getDaoProgress(firstDao);
      devLog.log(`✅ Statut: ${status}, Progrès: ${progress}%`);

      // Test 4: Statistiques globales
      devLog.log("📋 Test 4: Statistiques globales");
      const stats = await daoService.getDaoStats();
      devLog.log(`✅ Stats: ${stats.totalDaos} total, ${stats.daoEnCours} en cours, ${stats.daoTermines} terminés`);

      // Test 5: Recherche
      devLog.log("📋 Test 5: Recherche");
      const searchResults = await daoService.searchDaos(firstDao.numeroListe.substring(0, 3));
      devLog.log(`✅ ${searchResults.length} résultats de recherche`);

      // Test 6: Filtrage
      devLog.log("📋 Test 6: Filtrage");
      const filteredResults = await daoService.getFilteredDaos({
        autoriteContractante: firstDao.autoriteContractante
      });
      devLog.log(`✅ ${filteredResults.length} résultats filtrés`);
    }

    // Test 7: Récupération du prochain numéro DAO
    devLog.log("📋 Test 7: Prochain numéro DAO");
    const nextNumber = await daoService.getNextDaoNumber();
    devLog.log(`✅ Prochain numéro: ${nextNumber}`);

    devLog.log("🎉 Tous les tests du service DAO réussis!");
    return true;

  } catch (error) {
    devLog.error("❌ Erreur lors du test du service DAO:", error);
    return false;
  }
}

/**
 * Déclenche le test avec Ctrl+Shift+D
 */
if (typeof window !== 'undefined') {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      testDaoService();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
}
